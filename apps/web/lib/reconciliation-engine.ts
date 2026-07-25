import { prisma } from "@ahh-wfm/database";
import crypto from "crypto";
import { getQatarDateString } from "./roster-engine";

export interface ReconciliationRunOptions {
  operationType: "SECURITY_GUARDING" | "FACILITY_MANAGEMENT";
  contractId?: string;
  siteId?: string;
  businessDateStr: string;
  runType: "SCHEDULED" | "MANUAL" | "ATTENDANCE_EVENT";
  workerInstanceId?: string;
}

/**
 * Generate stable canonical expected-coverage identity & SHA-256 reconciliationKey.
 * Excludes mutable outcome, workflow status, resolution, and review notes.
 */
export function generateReconciliationKey(
  expectedPublicationId: string | null | undefined,
  expectedPublicationSlotId: string | null | undefined,
  expectedAssignmentIdOrSnapshot: string | null | undefined,
  expectedEmployeeId: string,
  scheduledStartUtcMs: number
): { canonicalIdentity: string; reconciliationKey: string } {
  const canonicalIdentity = `pub:${expectedPublicationId || ""}|pubSlot:${expectedPublicationSlotId || ""}|assignOrSnapshot:${expectedAssignmentIdOrSnapshot || ""}|emp:${expectedEmployeeId}|start:${scheduledStartUtcMs}`;
  const reconciliationKey = crypto.createHash("sha256").update(canonicalIdentity).digest("hex");
  return { canonicalIdentity, reconciliationKey };
}

export function parseShiftTimesUtc(
  businessDateStr: string,
  startTimeStr: string,
  endTimeStr: string
): { scheduledStartUtc: Date; scheduledEndUtc: Date } {
  const [sH, sM] = startTimeStr.split(":").map(Number);
  const [eH, eM] = endTimeStr.split(":").map(Number);

  // Business date in Qatar Time (UTC+3)
  const qatarStartStr = `${businessDateStr}T${String(sH).padStart(2, "0")}:${String(sM).padStart(2, "0")}:00+03:00`;
  const scheduledStartUtc = new Date(qatarStartStr);

  let endDateStr = businessDateStr;
  const isOvernight = eH < sH || (eH === sH && eM < sM);
  if (isOvernight) {
    const baseDate = new Date(`${businessDateStr}T00:00:00Z`);
    baseDate.setUTCDate(baseDate.getUTCDate() + 1);
    endDateStr = baseDate.toISOString().split("T")[0];
  }

  const qatarEndStr = `${endDateStr}T${String(eH).padStart(2, "0")}:${String(eM).padStart(2, "0")}:00+03:00`;
  const scheduledEndUtc = new Date(qatarEndStr);

  return { scheduledStartUtc, scheduledEndUtc };
}

/**
 * 6-tier Configuration Precedence Resolution:
 * SHIFT -> SITE -> PROJECT -> CONTRACT -> OPERATION -> GLOBAL fallback
 */
export async function resolveReconciliationConfig(
  operationType: string,
  contractId?: string,
  projectId?: string,
  siteId?: string,
  shiftKey?: string
) {
  const configs = await prisma.reconciliationGracePeriodConfig.findMany({
    where: {
      operationType,
      status: "ACTIVE",
      OR: [
        { scopeType: "SHIFT", shiftKey, siteId: siteId || undefined },
        { scopeType: "SITE", siteId: siteId || undefined },
        { scopeType: "PROJECT", projectId: projectId || undefined },
        { scopeType: "CONTRACT", contractId: contractId || undefined },
        { scopeType: "OPERATION", operationType },
        { scopeType: "GLOBAL" }
      ]
    }
  });

  // 1. SHIFT (Requires matching shiftKey and siteId)
  if (shiftKey && siteId) {
    const shiftMatch = configs.find(c => c.scopeType === "SHIFT" && c.shiftKey === shiftKey && c.siteId === siteId);
    if (shiftMatch) return shiftMatch;
  }

  // 2. SITE
  if (siteId) {
    const siteMatch = configs.find(c => c.scopeType === "SITE" && c.siteId === siteId);
    if (siteMatch) return siteMatch;
  }

  // 3. PROJECT
  if (projectId) {
    const projectMatch = configs.find(c => c.scopeType === "PROJECT" && c.projectId === projectId);
    if (projectMatch) return projectMatch;
  }

  // 4. CONTRACT
  if (contractId) {
    const contractMatch = configs.find(c => c.scopeType === "CONTRACT" && c.contractId === contractId);
    if (contractMatch) return contractMatch;
  }

  // 5. OPERATION
  const opMatch = configs.find(c => c.scopeType === "OPERATION" && c.operationType === operationType);
  if (opMatch) return opMatch;

  // 6. GLOBAL
  const globalMatch = configs.find(c => c.scopeType === "GLOBAL");
  if (globalMatch) return globalMatch;

  // Ensure an editable seed record exists in DB for GLOBAL pilot values
  try {
    const seededGlobal = await prisma.reconciliationGracePeriodConfig.upsert({
      where: { scopeKey_configVersion: { scopeKey: "GLOBAL:ALL", configVersion: 1 } },
      update: {},
      create: {
        scopeType: "GLOBAL",
        scopeKey: "GLOBAL:ALL",
        configVersion: 1,
        activeScopeKey: "GLOBAL:ALL:ACTIVE",
        status: "ACTIVE",
        operationType: operationType || "SECURITY_GUARDING",
        gracePeriodMinutes: 15,
        noCheckInThresholdMinutes: 30,
        earlyCheckInAllowanceMinutes: 60,
        syncDelayThresholdMinutes: 30,
        attendanceExempt: false,
        createdById: "SYSTEM"
      }
    });
    return seededGlobal;
  } catch (e) {
    // Return controlled config structure with ID snapshot fallback
    return {
      id: null,
      scopeType: "UNRESOLVED_CONFIG",
      gracePeriodMinutes: 15,
      noCheckInThresholdMinutes: 30,
      earlyCheckInAllowanceMinutes: 60,
      syncDelayThresholdMinutes: 30,
      attendanceExempt: false
    };
  }
}

/**
 * Hardened Atomic Scope Lock Acquisition
 */
export async function acquireReconciliationScopeLock(
  operationType: string,
  businessDateStr: string,
  ownerToken: string
) {
  const lockKey = `RECON_LOCK:${operationType}:${businessDateStr}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60000); // 60s lease
  const businessDate = new Date(`${businessDateStr}T00:00:00Z`);

  try {
    const lock = await prisma.manpowerReconciliationScopeLock.create({
      data: {
        lockKey,
        ownerToken,
        leaseVersion: 1,
        operationType,
        businessDate,
        acquiredAt: now,
        expiresAt
      }
    });
    return lock;
  } catch (e) {
    // Attempt conditional takeover of expired lock
    const updated = await prisma.manpowerReconciliationScopeLock.updateMany({
      where: {
        lockKey,
        expiresAt: { lt: now }
      },
      data: {
        ownerToken,
        leaseVersion: { increment: 1 },
        acquiredAt: now,
        renewedAt: now,
        expiresAt
      }
    });

    if (updated.count > 0) {
      const lock = await prisma.manpowerReconciliationScopeLock.findUnique({ where: { lockKey } });
      if (lock && lock.ownerToken === ownerToken) {
        return lock;
      }
    }
    return null; // Active valid lock protected
  }
}

export async function renewReconciliationScopeLock(lockId: string, ownerToken: string) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60000);
  const res = await prisma.manpowerReconciliationScopeLock.updateMany({
    where: { id: lockId, ownerToken, expiresAt: { gte: now } },
    data: { renewedAt: now, expiresAt }
  });
  return res.count > 0;
}

export async function releaseReconciliationScopeLock(lockId: string, ownerToken: string) {
  try {
    await prisma.manpowerReconciliationScopeLock.deleteMany({
      where: { id: lockId, ownerToken }
    });
  } catch (e) {}
}

/**
 * Core Reconciliation Run Execution Engine
 */
export async function executeReconciliationRun(options: ReconciliationRunOptions) {
  const { operationType, contractId, siteId, businessDateStr, runType, workerInstanceId = "worker-instance-01" } = options;
  const lock = await acquireReconciliationScopeLock(operationType, businessDateStr, workerInstanceId);
  if (!lock) {
    return { success: false, reason: "LOCKED", message: "Scope lock is currently held by another worker cycle." };
  }

  const businessDate = new Date(`${businessDateStr}T00:00:00Z`);
  const nowUtc = new Date();

  const runRecord = await prisma.manpowerReconciliationRun.create({
    data: {
      operationType,
      contractId,
      siteId,
      businessDate,
      windowStartUtc: nowUtc,
      windowEndUtc: nowUtc,
      runType,
      runStatus: "RUNNING",
      workerInstanceId
    }
  });

  try {
    // Query active RosterPublication for scope
    const publicationWhere: any = {
      operationType,
      status: "ACTIVE"
    };
    if (contractId) publicationWhere.contractId = contractId;
    if (siteId) publicationWhere.siteId = siteId;

    const publication = await prisma.rosterPublication.findFirst({
      where: publicationWhere,
      include: {
        contract: true,
        site: { include: { project: true } },
        publicationSlots: {
          where: { businessDate },
          include: { slot: true }
        }
      },
      orderBy: { publicationVersion: "desc" }
    });

    if (!publication) {
      // NO_PUBLISHED_ROSTER scope outcome: run record created, 0 reconciliation rows created
      await prisma.manpowerReconciliationRun.update({
        where: { id: runRecord.id },
        data: {
          runStatus: "COMPLETED",
          scopeOutcome: "NO_PUBLISHED_ROSTER",
          processedCount: 0,
          completedAt: new Date()
        }
      });
      await releaseReconciliationScopeLock(lock.id, workerInstanceId);
      return { success: true, scopeOutcome: "NO_PUBLISHED_ROSTER", processedCount: 0, message: "No active publication exists for this scope." };
    }

    let processedCount = 0;
    let onTimeCount = 0;
    let lateCount = 0;
    let noCheckInCount = 0;
    let suppressedCount = 0;
    let errorCount = 0;

    const activeSlots = (publication as any).publicationSlots || [];
    for (const pubSlot of activeSlots) {
      if (!pubSlot.employeeId || pubSlot.sourceAssignmentRole === "UNFILLED" || pubSlot.coverageType === "VACANT") {
        continue;
      }

      processedCount++;

      const config = await resolveReconciliationConfig(
        operationType,
        publication.contractId,
        (publication as any).site?.projectId,
        publication.siteId || undefined,
        pubSlot.slot?.shiftKey
      );

      const { scheduledStartUtc, scheduledEndUtc } = parseShiftTimesUtc(
        businessDateStr,
        pubSlot.startTime,
        pubSlot.endTime
      );

      const expectedEmployee = await prisma.employee.findUnique({
        where: { id: pubSlot.employeeId }
      });

      if (!expectedEmployee) continue;

      // Generate STABLE Canonical Identity & Key (Omits mutable outcome/status)
      const { canonicalIdentity, reconciliationKey } = generateReconciliationKey(
        publication.id,
        pubSlot.id,
        pubSlot.sourceAssignmentId || pubSlot.snapshotKey,
        pubSlot.employeeId,
        scheduledStartUtc.getTime()
      );

      // Check Site Exemption
      if (config.attendanceExempt) {
        suppressedCount++;
        await upsertReconciliationRecord({
          operationType,
          contractId: publication.contractId,
          contractCode: (publication as any).contract?.contractNumber || publication.contractId,
          contractTitle: (publication as any).contract?.title || publication.contractId,
          projectId: (publication as any).site?.projectId || null,
          projectCode: (publication as any).site?.project?.code || null,
          projectName: (publication as any).site?.project?.name || null,
          siteId: publication.siteId || null,
          siteCode: (publication as any).site?.code || null,
          siteName: (publication as any).site?.name || null,
          slotId: pubSlot.slotId,
          expectedPublicationId: publication.id,
          expectedPublicationVersion: publication.publicationVersion,
          expectedPublicationSlotId: pubSlot.id,
          expectedSnapshotKey: pubSlot.snapshotKey,
          expectedAssignmentId: pubSlot.sourceAssignmentId || null,
          expectedAssignmentRole: pubSlot.sourceAssignmentRole === "RELIEVER" ? "RELIEVER" : "PRIMARY",
          expectedEmployeeId: pubSlot.employeeId,
          expectedEmployeeCode: expectedEmployee.id,
          expectedEmployeeName: expectedEmployee.name,
          expectedShiftCode: pubSlot.shiftName,
          expectedPosition: pubSlot.position,
          expectedSourceType: pubSlot.sourceAssignmentRole === "RELIEVER" ? "PUBLISHED_RELIEVER" : "PUBLISHED_PRIMARY",
          suppressionSourceType: "SITE_EXEMPTION",
          businessDate,
          shiftKey: pubSlot.slot?.shiftKey || `custom:${pubSlot.startTime}-${pubSlot.endTime}`,
          scheduledStartUtc,
          scheduledEndUtc,
          resolvedConfigId: config.id || null,
          resolvedGracePeriodMinutes: config.gracePeriodMinutes,
          resolvedNoCheckInThresholdMinutes: config.noCheckInThresholdMinutes,
          resolvedEarlyAllowanceMinutes: config.earlyCheckInAllowanceMinutes,
          resolvedSyncThresholdMinutes: config.syncDelayThresholdMinutes,
          detectionOutcome: "SUPPRESSED",
          workflowStatus: "RESOLVED",
          resolution: "NOT_APPLICABLE",
          suppressionReason: "SITE_EXEMPTION",
          canonicalIdentity,
          reconciliationKey
        });
        continue;
      }

      // Check Approved Leave Overlay
      const approvedLeave = await prisma.leaveRequest.findFirst({
        where: {
          employeeId: pubSlot.employeeId,
          status: "APPROVED",
          startDate: { lte: scheduledEndUtc },
          endDate: { gte: scheduledStartUtc }
        }
      });

      if (approvedLeave) {
        suppressedCount++;
        await upsertReconciliationRecord({
          operationType,
          contractId: publication.contractId,
          contractCode: (publication as any).contract?.contractNumber || publication.contractId,
          contractTitle: (publication as any).contract?.title || publication.contractId,
          projectId: (publication as any).site?.projectId || null,
          projectCode: (publication as any).site?.project?.code || null,
          projectName: (publication as any).site?.project?.name || null,
          siteId: publication.siteId || null,
          siteCode: (publication as any).site?.code || null,
          siteName: (publication as any).site?.name || null,
          slotId: pubSlot.slotId,
          expectedPublicationId: publication.id,
          expectedPublicationVersion: publication.publicationVersion,
          expectedPublicationSlotId: pubSlot.id,
          expectedSnapshotKey: pubSlot.snapshotKey,
          expectedAssignmentId: pubSlot.sourceAssignmentId || null,
          expectedAssignmentRole: pubSlot.sourceAssignmentRole === "RELIEVER" ? "RELIEVER" : "PRIMARY",
          expectedEmployeeId: pubSlot.employeeId,
          expectedEmployeeCode: expectedEmployee.id,
          expectedEmployeeName: expectedEmployee.name,
          expectedShiftCode: pubSlot.shiftName,
          expectedPosition: pubSlot.position,
          expectedSourceType: pubSlot.sourceAssignmentRole === "RELIEVER" ? "PUBLISHED_RELIEVER" : "PUBLISHED_PRIMARY",
          suppressionSourceType: "APPROVED_LEAVE",
          businessDate,
          shiftKey: pubSlot.slot?.shiftKey || `custom:${pubSlot.startTime}-${pubSlot.endTime}`,
          scheduledStartUtc,
          scheduledEndUtc,
          resolvedConfigId: config.id || null,
          resolvedGracePeriodMinutes: config.gracePeriodMinutes,
          resolvedNoCheckInThresholdMinutes: config.noCheckInThresholdMinutes,
          resolvedEarlyAllowanceMinutes: config.earlyCheckInAllowanceMinutes,
          resolvedSyncThresholdMinutes: config.syncDelayThresholdMinutes,
          detectionOutcome: "SUPPRESSED",
          workflowStatus: "RESOLVED",
          resolution: "EXCUSED",
          suppressionReason: "APPROVED_LEAVE",
          canonicalIdentity,
          reconciliationKey
        });
        continue;
      }

      // Check Active Day-Off / Absence Exception Overlay
      const planningException = await prisma.rosterPlanningException.findFirst({
        where: {
          employeeId: pubSlot.employeeId,
          slotId: pubSlot.slotId,
          status: "ACTIVE"
        }
      });

      if (planningException && (planningException.exceptionType === "DAY_OFF" || planningException.exceptionType === "LEAVE_EFFECT")) {
        suppressedCount++;
        await upsertReconciliationRecord({
          operationType,
          contractId: publication.contractId,
          contractCode: (publication as any).contract?.contractNumber || publication.contractId,
          contractTitle: (publication as any).contract?.title || publication.contractId,
          projectId: (publication as any).site?.projectId || null,
          projectCode: (publication as any).site?.project?.code || null,
          projectName: (publication as any).site?.project?.name || null,
          siteId: publication.siteId || null,
          siteCode: (publication as any).site?.code || null,
          siteName: (publication as any).site?.name || null,
          slotId: pubSlot.slotId,
          expectedPublicationId: publication.id,
          expectedPublicationVersion: publication.publicationVersion,
          expectedPublicationSlotId: pubSlot.id,
          expectedSnapshotKey: pubSlot.snapshotKey,
          expectedAssignmentId: pubSlot.sourceAssignmentId || null,
          expectedAssignmentRole: pubSlot.sourceAssignmentRole === "RELIEVER" ? "RELIEVER" : "PRIMARY",
          expectedEmployeeId: pubSlot.employeeId,
          expectedEmployeeCode: expectedEmployee.id,
          expectedEmployeeName: expectedEmployee.name,
          expectedShiftCode: pubSlot.shiftName,
          expectedPosition: pubSlot.position,
          expectedSourceType: pubSlot.sourceAssignmentRole === "RELIEVER" ? "PUBLISHED_RELIEVER" : "PUBLISHED_PRIMARY",
          suppressionSourceType: "DAY_OFF",
          businessDate,
          shiftKey: pubSlot.slot?.shiftKey || `custom:${pubSlot.startTime}-${pubSlot.endTime}`,
          scheduledStartUtc,
          scheduledEndUtc,
          resolvedConfigId: config.id || null,
          resolvedGracePeriodMinutes: config.gracePeriodMinutes,
          resolvedNoCheckInThresholdMinutes: config.noCheckInThresholdMinutes,
          resolvedEarlyAllowanceMinutes: config.earlyCheckInAllowanceMinutes,
          resolvedSyncThresholdMinutes: config.syncDelayThresholdMinutes,
          detectionOutcome: "SUPPRESSED",
          workflowStatus: "RESOLVED",
          resolution: "EXCUSED",
          suppressionReason: "DAY_OFF",
          canonicalIdentity,
          reconciliationKey
        });
        continue;
      }

      // Check Active Reliever Coverage Replacement Overlay (Replaced Primary is Suppressed)
      const activeRelieverAssignment = await prisma.rosterSlotAssignment.findFirst({
        where: {
          slotId: pubSlot.slotId,
          assignmentType: "RELIEVER",
          replacesAssignmentId: pubSlot.sourceAssignmentId || undefined,
          historyStatus: "ACTIVE"
        }
      });

      if (activeRelieverAssignment && pubSlot.sourceAssignmentRole === "PRIMARY" && activeRelieverAssignment.employeeId !== pubSlot.employeeId) {
        suppressedCount++;
        await upsertReconciliationRecord({
          operationType,
          contractId: publication.contractId,
          contractCode: (publication as any).contract?.contractNumber || publication.contractId,
          contractTitle: (publication as any).contract?.title || publication.contractId,
          projectId: (publication as any).site?.projectId || null,
          projectCode: (publication as any).site?.project?.code || null,
          projectName: (publication as any).site?.project?.name || null,
          siteId: publication.siteId || null,
          siteCode: (publication as any).site?.code || null,
          siteName: (publication as any).site?.name || null,
          slotId: pubSlot.slotId,
          expectedPublicationId: publication.id,
          expectedPublicationVersion: publication.publicationVersion,
          expectedPublicationSlotId: pubSlot.id,
          expectedSnapshotKey: pubSlot.snapshotKey,
          expectedAssignmentId: pubSlot.sourceAssignmentId || null,
          expectedAssignmentRole: "PRIMARY",
          expectedEmployeeId: pubSlot.employeeId,
          expectedEmployeeCode: expectedEmployee.id,
          expectedEmployeeName: expectedEmployee.name,
          expectedShiftCode: pubSlot.shiftName,
          expectedPosition: pubSlot.position,
          expectedSourceType: "PUBLISHED_PRIMARY",
          suppressionSourceType: "ACTIVE_RELIEVER",
          businessDate,
          shiftKey: pubSlot.slot?.shiftKey || `custom:${pubSlot.startTime}-${pubSlot.endTime}`,
          scheduledStartUtc,
          scheduledEndUtc,
          resolvedConfigId: config.id || null,
          resolvedGracePeriodMinutes: config.gracePeriodMinutes,
          resolvedNoCheckInThresholdMinutes: config.noCheckInThresholdMinutes,
          resolvedEarlyAllowanceMinutes: config.earlyCheckInAllowanceMinutes,
          resolvedSyncThresholdMinutes: config.syncDelayThresholdMinutes,
          detectionOutcome: "SUPPRESSED",
          workflowStatus: "RESOLVED",
          resolution: "NOT_APPLICABLE",
          suppressionReason: "ACTIVE_RELIEVER",
          canonicalIdentity,
          reconciliationKey
        });
        continue;
      }

      // Attendance Punch Matching
      const earlyWindowStart = new Date(scheduledStartUtc.getTime() - config.earlyCheckInAllowanceMinutes * 60000);
      const postWindowEnd = new Date(scheduledEndUtc.getTime() + 180 * 60000);

      const matchingAttendance = await prisma.attendanceRecord.findFirst({
        where: {
          employeeId: pubSlot.employeeId,
          checkIn: { gte: earlyWindowStart, lte: postWindowEnd }
        },
        orderBy: { checkIn: "asc" }
      });

      const graceDeadline = new Date(scheduledStartUtc.getTime() + config.gracePeriodMinutes * 60000);
      const thresholdDeadline = new Date(scheduledStartUtc.getTime() + config.noCheckInThresholdMinutes * 60000);

      let detectionOutcome = "NO_CHECK_IN";
      let workflowStatus = "OPEN";
      let resolution = "NOT_APPLICABLE";
      let lateMinutes = 0;

      if (matchingAttendance) {
        const punchUtc = new Date(matchingAttendance.checkIn);
        if (punchUtc <= graceDeadline) {
          detectionOutcome = "ON_TIME";
          workflowStatus = "RESOLVED";
          resolution = "NOT_APPLICABLE";
          onTimeCount++;
        } else {
          detectionOutcome = "LATE";
          workflowStatus = "PENDING_REVIEW";
          resolution = "NOT_APPLICABLE";
          lateMinutes = Math.round((punchUtc.getTime() - scheduledStartUtc.getTime()) / 60000);
          lateCount++;
        }

        // Location Mismatch check
        if (publication.siteId && matchingAttendance.siteId && matchingAttendance.siteId !== publication.siteId) {
          detectionOutcome = "LOCATION_MISMATCH";
          workflowStatus = "PENDING_REVIEW";
        }
      } else {
        if (nowUtc >= thresholdDeadline) {
          detectionOutcome = "NO_CHECK_IN";
          workflowStatus = "PENDING_REVIEW";
          noCheckInCount++;
        } else {
          // Window open, pending shift start
          detectionOutcome = "ON_TIME";
          workflowStatus = "OPEN";
        }
      }

      await upsertReconciliationRecord({
        operationType,
        contractId: publication.contractId,
        contractCode: (publication as any).contract?.contractNumber || publication.contractId,
        contractTitle: (publication as any).contract?.title || publication.contractId,
        projectId: (publication as any).site?.projectId || null,
        projectCode: (publication as any).site?.project?.code || null,
        projectName: (publication as any).site?.project?.name || null,
        siteId: publication.siteId || null,
        siteCode: (publication as any).site?.code || null,
        siteName: (publication as any).site?.name || null,
        slotId: pubSlot.slotId,
        expectedPublicationId: publication.id,
        expectedPublicationVersion: publication.publicationVersion,
        expectedPublicationSlotId: pubSlot.id,
        expectedSnapshotKey: pubSlot.snapshotKey,
        expectedAssignmentId: pubSlot.sourceAssignmentId || null,
        expectedAssignmentRole: pubSlot.sourceAssignmentRole === "RELIEVER" ? "RELIEVER" : "PRIMARY",
        expectedEmployeeId: pubSlot.employeeId,
        expectedEmployeeCode: expectedEmployee.id,
        expectedEmployeeName: expectedEmployee.name,
        expectedShiftCode: pubSlot.shiftName,
        expectedPosition: pubSlot.position,
        expectedSourceType: pubSlot.sourceAssignmentRole === "RELIEVER" ? "PUBLISHED_RELIEVER" : "PUBLISHED_PRIMARY",
        attendanceRecordId: matchingAttendance?.id || null,
        rawCheckInUtc: matchingAttendance?.checkIn || null,
        originalCheckInUtc: matchingAttendance?.originalCheckIn || null,
        serverReceivedUtc: matchingAttendance?.checkIn || null,
        selectedPunchUtc: matchingAttendance?.checkIn || null,
        punchTimestampSource: matchingAttendance ? "CHECK_IN" : null,
        businessDate,
        shiftKey: pubSlot.slot?.shiftKey || `custom:${pubSlot.startTime}-${pubSlot.endTime}`,
        scheduledStartUtc,
        scheduledEndUtc,
        actualCheckInUtc: matchingAttendance?.checkIn || null,
        actualCheckOutUtc: matchingAttendance?.checkOut || null,
        resolvedConfigId: config.id || null,
        resolvedGracePeriodMinutes: config.gracePeriodMinutes,
        resolvedNoCheckInThresholdMinutes: config.noCheckInThresholdMinutes,
        resolvedEarlyAllowanceMinutes: config.earlyCheckInAllowanceMinutes,
        resolvedSyncThresholdMinutes: config.syncDelayThresholdMinutes,
        lateMinutes,
        detectionOutcome,
        workflowStatus,
        resolution,
        canonicalIdentity,
        reconciliationKey
      });
    }

    await prisma.manpowerReconciliationRun.update({
      where: { id: runRecord.id },
      data: {
        runStatus: "COMPLETED",
        scopeOutcome: "PROCESSED",
        publicationId: publication.id,
        processedCount,
        onTimeCount,
        lateCount,
        noCheckInCount,
        suppressedCount,
        errorCount,
        completedAt: new Date()
      }
    });

    await releaseReconciliationScopeLock(lock.id, workerInstanceId);
    return {
      success: true,
      scopeOutcome: "PROCESSED",
      processedCount,
      onTimeCount,
      lateCount,
      noCheckInCount,
      suppressedCount
    };

  } catch (err: any) {
    await prisma.manpowerReconciliationRun.update({
      where: { id: runRecord.id },
      data: {
        runStatus: "FAILED",
        errorCount: 1,
        errorSummary: err.message || "Reconciliation cycle failed.",
        completedAt: new Date()
      }
    }).catch(() => null);

    await releaseReconciliationScopeLock(lock.id, workerInstanceId);
    throw err;
  }
}

/**
 * Upsert Reconciliation Record by STABLE reconciliationKey.
 * Outcome state transitions (NO_CHECK_IN -> ON_TIME, LATE -> ON_TIME) update existing row.
 */
export async function upsertReconciliationRecord(data: any) {
  const existing = await prisma.attendanceRosterReconciliation.findUnique({
    where: { reconciliationKey: data.reconciliationKey }
  });

  if (!existing) {
    return prisma.attendanceRosterReconciliation.create({ data });
  }

  // Preserve supervisor review decision unless new punch arrives or correction changes state
  let finalWorkflowStatus = data.workflowStatus;
  let finalResolution = data.resolution;

  if (existing.workflowStatus === "RESOLVED" && existing.resolution !== "NOT_APPLICABLE") {
    // If punch hasn't changed, retain supervisor resolution
    if (existing.attendanceRecordId === data.attendanceRecordId && existing.detectionOutcome === data.detectionOutcome) {
      finalWorkflowStatus = existing.workflowStatus;
      finalResolution = existing.resolution;
    }
  }

  return prisma.attendanceRosterReconciliation.update({
    where: { id: existing.id },
    data: {
      ...data,
      workflowStatus: finalWorkflowStatus,
      resolution: finalResolution,
      rowVersion: { increment: 1 }
    }
  });
}

/**
 * Shared single-employee event-driven reconciliation trigger.
 * Used by Web check-in, Mobile check-in, Approved correction, Scheduled worker, Manual refresh.
 */
export async function reconcileSingleEmployeeAttendance(employeeId: string, punchTime: Date, siteId?: string) {
  const businessDateStr = getQatarDateString(punchTime);
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return;

  const operationType = (employee.operationType as "SECURITY_GUARDING" | "FACILITY_MANAGEMENT") || "SECURITY_GUARDING";

  return executeReconciliationRun({
    operationType,
    siteId,
    businessDateStr,
    runType: "ATTENDANCE_EVENT",
    workerInstanceId: "event-driven-trigger"
  }).catch(e => {
    console.error(`[Event-Driven Reconciliation] Failed for employee ${employeeId}:`, e.message);
  });
}
