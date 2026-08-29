import crypto from "crypto";
import { prisma } from "@ahh-wfm/database";
import { isAttendanceImportEnabled } from "@/lib/attendance-import-parser";

export function isAttendanceReconciliationEnabled(): boolean {
  if (!isAttendanceImportEnabled()) return false;
  return process.env.ATTENDANCE_RECONCILIATION_ENABLED === "true";
}

export const RECONCILIATION_STATUS = {
  NOT_STARTED: "NOT_STARTED",
  IN_REVIEW: "IN_REVIEW",
  REVIEW_COMPLETE: "REVIEW_COMPLETE",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  RETURNED: "RETURNED",
  REJECTED: "REJECTED",
  APPROVED: "APPROVED"
} as const;

export const EVIDENCE_ORIGIN = {
  IMPORT_ONLY: "IMPORT_ONLY",
  IMPORT_AND_SYSTEM: "IMPORT_AND_SYSTEM",
  SYSTEM_ONLY: "SYSTEM_ONLY"
} as const;

export const EVIDENCE_SUBTYPE = {
  ATTENDANCE_AND_ROSTER: "ATTENDANCE_AND_ROSTER",
  ATTENDANCE_ONLY: "ATTENDANCE_ONLY",
  UNCONFIRMED_IMPORT: "UNCONFIRMED_IMPORT",
  SYSTEM_ONLY_ATTENDANCE: "SYSTEM_ONLY_ATTENDANCE",
  SYSTEM_ONLY_ROSTER: "SYSTEM_ONLY_ROSTER"
} as const;

export const MATCH_CLASSIFICATION = {
  MATCHED: "MATCHED",
  WARNING: "WARNING",
  CONFLICT: "CONFLICT",
  BLOCKING: "BLOCKING"
} as const;

export const DECISION_TYPE = {
  MATCHED_NO_ACTION: "MATCHED_NO_ACTION",
  KEEP_EXISTING_ATTENDANCE: "KEEP_EXISTING_ATTENDANCE",
  USE_IMPORTED_ATTENDANCE: "USE_IMPORTED_ATTENDANCE",
  USE_APPROVED_LEAVE: "USE_APPROVED_LEAVE",
  ADJUST_PROPOSED_HOURS: "ADJUST_PROPOSED_HOURS",
  RESOLVE_STATUS: "RESOLVE_STATUS",
  RESOLVE_ASSIGNMENT: "RESOLVE_ASSIGNMENT",
  EXCLUDE_DUPLICATE: "EXCLUDE_DUPLICATE",
  EXCLUDE_ROW: "EXCLUDE_ROW"
} as const;

export const REASON_CODE = {
  CLIENT_TIMESHEET_VERIFIED: "CLIENT_TIMESHEET_VERIFIED",
  SUPERVISOR_CONFIRMED: "SUPERVISOR_CONFIRMED",
  MOBILE_DEVICE_OFFLINE: "MOBILE_DEVICE_OFFLINE",
  APPROVED_LEAVE_APPLIED: "APPROVED_LEAVE_APPLIED",
  ROSTER_CHANGE_EXECUTED: "ROSTER_CHANGE_EXECUTED",
  MANUAL_AUDIT_ADJUSTMENT: "MANUAL_AUDIT_ADJUSTMENT"
} as const;

export function buildOperationalCandidateKey(params: {
  companyId: string;
  operationType: string;
  employeeId?: string | null;
  dutyDateStr?: string | null;
  siteId?: string | null;
  rosterSlotAssignmentId?: string | null;
  shiftCode?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  rawEmployeeCode?: string | null;
  rawAttendanceDate?: string | null;
  rawSite?: string | null;
  rawShift?: string | null;
}): string {
  const {
    companyId,
    operationType,
    employeeId,
    dutyDateStr,
    siteId,
    rosterSlotAssignmentId,
    shiftCode,
    plannedStart,
    plannedEnd,
    rawEmployeeCode,
    rawAttendanceDate,
    rawSite,
    rawShift
  } = params;

  if (employeeId && dutyDateStr) {
    if (rosterSlotAssignmentId) {
      return `${companyId}:${operationType}:${employeeId}:${dutyDateStr}:${siteId || 'NOSITE'}:${rosterSlotAssignmentId}`;
    }
    const timeWindow = plannedStart && plannedEnd ? `${plannedStart}_${plannedEnd}` : (shiftCode || 'NOSHIFT');
    return `${companyId}:${operationType}:${employeeId}:${dutyDateStr}:${siteId || 'NOSITE'}:${shiftCode || 'NOSHIFT'}:${timeWindow}`;
  }

  // Unresolved Staging Error Fallback
  const rawEmp = rawEmployeeCode || 'NOEMP';
  const rawDate = rawAttendanceDate || 'NODATE';
  const rawSt = rawSite || 'NOSITE';
  const rawSh = rawShift || 'NOSHIFT';
  const rawWin = plannedStart && plannedEnd ? `${plannedStart}_${plannedEnd}` : 'NOWIN';
  return `${companyId}:${operationType}:${rawEmp}:${rawDate}:${rawSt}:${rawSh}:${rawWin}:UNRESOLVED`;
}

export function computeCanonicalSha256(data: any): string {
  const jsonStr = typeof data === "string" ? data : JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash("sha256").update(jsonStr, "utf8").digest("hex");
}

export function computeRowChecksum(row: {
  operationalCandidateKey: string;
  employeeId?: string | null;
  employeeCode: string;
  employeeName: string;
  companyId: string;
  operationType: string;
  dutyDate: Date | string;
  siteId?: string | null;
  siteName?: string | null;
  contractId?: string | null;
  contractNumber?: string | null;
  rosterSlotAssignmentId?: string | null;
  shiftCode?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  actualTimeIn?: Date | string | null;
  actualTimeOut?: Date | string | null;
  approvedStatus: string;
  approvedRegularMinutes: number;
  approvedOtMinutes: number;
  approvedLeaveType?: string | null;
  approvedAssignmentType?: string | null;
  reconciliationDecisionId: string;
  decisionType: string;
  reasonCode?: string | null;
  reasonNotes?: string | null;
}): string {
  const dutyDateStr = row.dutyDate instanceof Date ? row.dutyDate.toISOString().slice(0, 10) : String(row.dutyDate).slice(0, 10);
  const timeInStr = row.actualTimeIn ? (row.actualTimeIn instanceof Date ? row.actualTimeIn.toISOString() : String(row.actualTimeIn)) : "";
  const timeOutStr = row.actualTimeOut ? (row.actualTimeOut instanceof Date ? row.actualTimeOut.toISOString() : String(row.actualTimeOut)) : "";

  const canonicalRow = [
    row.operationalCandidateKey,
    row.employeeId || "",
    row.employeeCode,
    row.employeeName,
    row.companyId,
    row.operationType,
    dutyDateStr,
    row.siteId || "",
    row.siteName || "",
    row.contractId || "",
    row.contractNumber || "",
    row.rosterSlotAssignmentId || "",
    row.shiftCode || "",
    row.plannedStart || "",
    row.plannedEnd || "",
    timeInStr,
    timeOutStr,
    row.approvedStatus,
    row.approvedRegularMinutes,
    row.approvedOtMinutes,
    row.approvedLeaveType || "",
    row.approvedAssignmentType || "",
    row.reconciliationDecisionId,
    row.decisionType,
    row.reasonCode || "",
    row.reasonNotes || ""
  ].join("|");

  return crypto.createHash("sha256").update(canonicalRow, "utf8").digest("hex");
}

export function computeSnapshotHash(header: {
  reconciliationBatchId: string;
  approvalVersion: number;
  reconciliationVersion: number;
  sourceImportBatchId: string;
  sourceEvidenceHash: string;
  systemEvidenceHash: string;
  totalRows: number;
  approvedRegularMinutesTotal: number;
  approvedOtMinutesTotal: number;
}, sortedRowChecksums: string[]): string {
  const headerStr = [
    header.reconciliationBatchId,
    header.approvalVersion,
    header.reconciliationVersion,
    header.sourceImportBatchId,
    header.sourceEvidenceHash,
    header.systemEvidenceHash,
    header.totalRows,
    header.approvedRegularMinutesTotal,
    header.approvedOtMinutesTotal
  ].join("|");

  const combined = headerStr + "||" + sortedRowChecksums.join(",");
  return crypto.createHash("sha256").update(combined, "utf8").digest("hex");
}

export async function calculateSourceEvidenceHash(importBatchId: string): Promise<string> {
  const rows = await prisma.attendanceImportRow.findMany({
    where: { batchId: importBatchId },
    orderBy: { sourceRowNumber: "asc" }
  });

  const canonicalPayloads = rows.map(r => {
    const valCodes = r.validationMessages && Array.isArray(r.validationMessages)
      ? (r.validationMessages as any[]).map((m: any) => m.code || "").sort().join(",")
      : "";

    return [
      r.sourceRowNumber,
      r.rawEmployeeCode || "",
      r.rawAttendanceDate || "",
      r.rawActualTimeIn || "",
      r.rawActualTimeOut || "",
      r.rawWorkedHours || "",
      r.rawOtHours || "",
      r.rawAttendanceStatus || "",
      r.rawShift || "",
      r.rawPlannedStart || "",
      r.rawPlannedEnd || "",
      r.rawSite || "",
      r.rawContract || "",
      r.employeeId || "",
      r.siteId || "",
      r.contractId || "",
      r.rosterSlotAssignmentId || "",
      r.companyId || "",
      r.attendanceDate ? r.attendanceDate.toISOString().slice(0, 10) : "",
      r.workedHours !== null && r.workedHours !== undefined ? r.workedHours.toFixed(2) : "",
      r.otHours !== null && r.otHours !== undefined ? r.otHours.toFixed(2) : "",
      r.normalizedStatus || "",
      r.validationStatus,
      valCodes
    ].join("|");
  });

  return computeCanonicalSha256(canonicalPayloads.join("\n"));
}

export async function calculateSystemEvidence(
  companyId: string,
  operationType: string,
  employeeIds: string[],
  dates: Date[]
): Promise<{
  systemEvidenceHash: string;
  fingerprintsByCandidate: Record<string, { evidence: any; fingerprint: string; subtype: string }>;
  unimportedSystemEvidence: Array<{
    employeeId: string;
    dutyDate: Date;
    evidenceType: "ATTENDANCE" | "ROSTER";
    record: any;
  }>;
}> {
  if (employeeIds.length === 0 || dates.length === 0) {
    return {
      systemEvidenceHash: computeCanonicalSha256("EMPTY_SYSTEM_EVIDENCE"),
      fingerprintsByCandidate: {},
      unimportedSystemEvidence: []
    };
  }

  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
  const queryStart = new Date(minDate);
  queryStart.setUTCHours(0, 0, 0, 0);
  const queryEnd = new Date(maxDate);
  queryEnd.setUTCHours(23, 59, 59, 999);

  const [attendances, rosterAssignments, leaves, closures] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: {
        employeeId: { in: employeeIds },
        checkIn: { gte: queryStart, lte: queryEnd }
      },
      select: {
        id: true,
        employeeId: true,
        employeeName: true,
        checkIn: true,
        checkOut: true,
        status: true,
        device: true,
        shiftId: true,
        standardOtMinutes: true,
        otApprovedMinutes: true
      },
      orderBy: { checkIn: "asc" }
    }),
    prisma.rosterSlotAssignment.findMany({
      where: {
        employeeId: { in: employeeIds },
        slot: { businessDate: { gte: queryStart, lte: queryEnd } }
      },
      select: {
        id: true,
        employeeId: true,
        slotId: true,
        assignmentType: true,
        historyStatus: true,
        slot: {
          select: {
            businessDate: true,
            snapshotStartTime: true,
            snapshotEndTime: true,
            snapshotShiftName: true,
            siteId: true,
            contractId: true
          }
        }
      }
    }),
    prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: { in: ["Approved", "APPROVED"] },
        startDate: { lte: queryEnd },
        endDate: { gte: queryStart }
      },
      select: {
        id: true,
        employeeId: true,
        type: true,
        startDate: true,
        endDate: true,
        status: true
      }
    }),
    prisma.manpowerDailyClosure.findMany({
      where: {
        companyId,
        businessDate: { gte: queryStart, lte: queryEnd }
      },
      select: {
        id: true,
        companyId: true,
        siteId: true,
        businessDate: true,
        status: true
      }
    })
  ]);

  const attFingerprints = attendances.map(a =>
    [a.id, a.employeeId, a.checkIn.toISOString(), a.checkOut?.toISOString() || "", a.status, a.device, a.standardOtMinutes, a.otApprovedMinutes].join("|")
  );
  const rosterFingerprints = rosterAssignments.map(r =>
    [r.id, r.employeeId, r.slotId, r.slot?.businessDate?.toISOString().slice(0, 10) || "", r.slot?.snapshotShiftName || "", r.assignmentType, r.historyStatus].join("|")
  );
  const leaveFingerprints = leaves.map(l =>
    [l.id, l.employeeId, l.type, l.startDate?.toISOString().slice(0, 10) || "", l.endDate?.toISOString().slice(0, 10) || "", l.status].join("|")
  );
  const closureFingerprints = closures.map(c =>
    [c.id, c.companyId, c.siteId, c.businessDate.toISOString().slice(0, 10), c.status].join("|")
  );

  attFingerprints.sort();
  rosterFingerprints.sort();
  leaveFingerprints.sort();
  closureFingerprints.sort();

  const combinedSystemFingerprint = [
    computeCanonicalSha256(attFingerprints.join("\n")),
    computeCanonicalSha256(rosterFingerprints.join("\n")),
    computeCanonicalSha256(leaveFingerprints.join("\n")),
    computeCanonicalSha256(closureFingerprints.join("\n"))
  ].join("||");

  const systemEvidenceHash = computeCanonicalSha256(combinedSystemFingerprint);

  const fingerprintsByCandidate: Record<string, { evidence: any; fingerprint: string; subtype: string }> = {};

  for (const empId of employeeIds) {
    for (const date of dates) {
      const dateStr = date.toISOString().slice(0, 10);
      const empAttendances = attendances.filter(a => {
        const aDate = a.checkIn.toISOString().slice(0, 10);
        return a.employeeId === empId && aDate === dateStr;
      }).map(a => {
        const totalHrs = a.checkOut ? ((a.checkOut.getTime() - a.checkIn.getTime()) / (1000 * 3600)) : 0;
        return {
          id: a.id,
          checkIn: a.checkIn,
          checkOut: a.checkOut,
          status: a.status,
          totalHours: Math.round(totalHrs * 100) / 100,
          source: a.device,
          standardOtMinutes: a.standardOtMinutes,
          otApprovedMinutes: a.otApprovedMinutes
        };
      });

      const empRoster = rosterAssignments.filter(r => {
        const bDate = r.slot?.businessDate?.toISOString().slice(0, 10);
        return r.employeeId === empId && bDate === dateStr;
      });

      const empLeaves = leaves.filter(l => l.employeeId === empId && l.startDate && l.endDate && l.startDate <= date && l.endDate >= date);

      const hasAtt = empAttendances.length > 0;
      const hasRos = empRoster.length > 0;

      let subtype: string = EVIDENCE_SUBTYPE.UNCONFIRMED_IMPORT;
      if (hasAtt && hasRos) {
        subtype = EVIDENCE_SUBTYPE.ATTENDANCE_AND_ROSTER;
      } else if (hasAtt) {
        subtype = EVIDENCE_SUBTYPE.ATTENDANCE_ONLY;
      } else if (hasRos) {
        subtype = EVIDENCE_SUBTYPE.SYSTEM_ONLY_ROSTER;
      }

      const evidence = {
        attendances: empAttendances,
        roster: empRoster.map(r => ({
          id: r.id,
          slotId: r.slotId,
          shift: r.slot?.snapshotShiftName,
          startTime: r.slot?.snapshotStartTime,
          endTime: r.slot?.snapshotEndTime,
          siteId: r.slot?.siteId,
          contractId: r.slot?.contractId,
          type: r.assignmentType,
          status: r.historyStatus
        })),
        leaves: empLeaves.map(l => ({ id: l.id, leaveType: l.type, status: l.status }))
      };

      const key = `${empId}_${dateStr}`;
      const fingerprint = computeCanonicalSha256(evidence);
      fingerprintsByCandidate[key] = { evidence, fingerprint, subtype };
    }
  }

  return {
    systemEvidenceHash,
    fingerprintsByCandidate,
    unimportedSystemEvidence: []
  };
}

export async function initializeReconciliation(importBatchId: string, actor: { id: string; name?: string; role?: string }): Promise<any> {
  const importBatch = await prisma.attendanceImportBatch.findUnique({
    where: { id: importBatchId },
    include: {
      rows: {
        include: {
          employee: true,
          site: true,
          contract: true
        },
        orderBy: { sourceRowNumber: "asc" }
      }
    }
  });

  if (!importBatch) {
    throw new Error("Import batch not found.");
  }

  if (importBatch.operationType !== "SECURITY_GUARDING" && importBatch.operationType !== "FACILITY_MANAGEMENT") {
    throw new Error("Attendance Reconciliation is strictly restricted to Security Guarding and Facility Management.");
  }

  if (!importBatch.companyId) {
    throw new Error("Import batch company is required for reconciliation.");
  }

  const existingRec = await prisma.attendanceReconciliationBatch.findUnique({
    where: { importBatchId },
    include: {
      candidates: {
        include: {
          sources: true,
          currentDecision: true
        }
      },
      events: { orderBy: { createdAt: "desc" }, take: 10 }
    }
  });

  if (existingRec) {
    return existingRec;
  }

  const periodYear = importBatch.attendancePeriodFrom ? importBatch.attendancePeriodFrom.getFullYear() : new Date().getFullYear();
  const periodMonth = importBatch.attendancePeriodFrom ? importBatch.attendancePeriodFrom.getMonth() + 1 : new Date().getMonth() + 1;

  const validDates: Date[] = [];
  const employeeIds: string[] = [];

  for (const row of importBatch.rows) {
    if (row.attendanceDate) validDates.push(row.attendanceDate);
    if (row.employeeId && !employeeIds.includes(row.employeeId)) employeeIds.push(row.employeeId);
  }

  const [sourceEvidenceHash, { systemEvidenceHash, fingerprintsByCandidate }] = await Promise.all([
    calculateSourceEvidenceHash(importBatchId),
    calculateSystemEvidence(importBatch.companyId, importBatch.operationType, employeeIds, validDates)
  ]);

  let seq = 1;
  const periodStr = `${periodYear}${String(periodMonth).padStart(2, '0')}`;
  let batchNumber = `ARB-${periodStr}-${String(seq).padStart(4, '0')}`;
  while (await prisma.attendanceReconciliationBatch.findUnique({ where: { batchNumber } })) {
    seq++;
    batchNumber = `ARB-${periodStr}-${String(seq).padStart(4, '0')}`;
  }

  // Group rows by operationalCandidateKey to handle collapsed duplicate rows
  const candidatesMap = new Map<string, {
    candidateKey: string;
    evidenceOrigin: string;
    evidenceSubtype: string;
    employeeId: string | null;
    dutyDate: Date | null;
    siteId: string | null;
    contractId: string | null;
    shiftCode: string | null;
    rosterSlotAssignmentId: string | null;
    matchClassification: "MATCHED" | "WARNING" | "CONFLICT" | "BLOCKING";
    conflictDetails: any;
    importedEvidence: any;
    systemEvidence: any;
    systemEvidenceFingerprint: string | null;
    resolvedStatus: string;
    resolvedTimeIn: Date | null;
    resolvedTimeOut: Date | null;
    resolvedWorkedMinutes: number;
    resolvedOtMinutes: number;
    resolvedLeaveType: string | null;
    resolvedAssignmentType: string | null;
    resolvedSiteId: string | null;
    isResolved: boolean;
    sources: Array<{
      importRowId: string;
      sourceRowNumber: number;
      sourceSheetName: string | null;
      sourceCellProvenance: string | null;
      rawPayload: any;
    }>;
  }>();

  for (const row of importBatch.rows) {
    const dutyDateStr = row.attendanceDate ? row.attendanceDate.toISOString().slice(0, 10) : (row.rawAttendanceDate || "NODATE");
    const opKey = buildOperationalCandidateKey({
      companyId: importBatch.companyId,
      operationType: importBatch.operationType,
      employeeId: row.employeeId,
      dutyDateStr,
      siteId: row.siteId,
      rosterSlotAssignmentId: row.rosterSlotAssignmentId,
      shiftCode: row.rawShift,
      plannedStart: row.rawPlannedStart,
      plannedEnd: row.rawPlannedEnd,
      rawEmployeeCode: row.rawEmployeeCode,
      rawAttendanceDate: row.rawAttendanceDate,
      rawSite: row.rawSite,
      rawShift: row.rawShift
    });

    const sysKey = `${row.employeeId || 'NOEMP'}_${dutyDateStr}`;
    const sysData = fingerprintsByCandidate[sysKey] || {
      evidence: { attendances: [], roster: [], leaves: [] },
      fingerprint: "NONE",
      subtype: EVIDENCE_SUBTYPE.UNCONFIRMED_IMPORT
    };

    let matchClass: "MATCHED" | "WARNING" | "CONFLICT" | "BLOCKING" = "MATCHED";
    const conflicts: string[] = [];

    if (row.validationStatus === "ERROR" || row.validationStatus === "DUPLICATE" || !row.employeeId) {
      matchClass = "BLOCKING";
      conflicts.push(row.duplicateReason || "Row has validation errors or unmapped employee code.");
    } else if (sysData.evidence.leaves && sysData.evidence.leaves.length > 0) {
      matchClass = "CONFLICT";
      conflicts.push(`Employee has approved leave (${sysData.evidence.leaves[0].leaveType}) on duty date.`);
    } else if (sysData.evidence.attendances && sysData.evidence.attendances.length > 0) {
      const existing = sysData.evidence.attendances[0];
      const impWorkedHours = row.workedHours || 0;
      if (Math.abs((existing.totalHours || 0) - impWorkedHours) > 0.1) {
        matchClass = "CONFLICT";
        conflicts.push(`Imported worked hours (${impWorkedHours}h) differ from existing attendance record (${existing.totalHours || 0}h).`);
      } else {
        matchClass = "MATCHED";
      }
    } else if (row.validationStatus === "WARNING") {
      matchClass = "WARNING";
      conflicts.push("Row has validation warning.");
    } else {
      matchClass = "MATCHED";
    }

    const workedMins = row.workedHours ? Math.round(row.workedHours * 60) : 0;
    const otMins = row.otHours ? Math.round(row.otHours * 60) : 0;

    if (!candidatesMap.has(opKey)) {
      candidatesMap.set(opKey, {
        candidateKey: opKey,
        evidenceOrigin: sysData.evidence.attendances.length > 0 || sysData.evidence.roster.length > 0 ? EVIDENCE_ORIGIN.IMPORT_AND_SYSTEM : EVIDENCE_ORIGIN.IMPORT_ONLY,
        evidenceSubtype: sysData.subtype,
        employeeId: row.employeeId,
        dutyDate: row.attendanceDate,
        siteId: row.siteId,
        contractId: row.contractId,
        shiftCode: row.rawShift,
        rosterSlotAssignmentId: row.rosterSlotAssignmentId,
        matchClassification: matchClass,
        conflictDetails: conflicts.length > 0 ? { issues: conflicts } : null,
        importedEvidence: {
          rawAttendanceDate: row.rawAttendanceDate,
          rawEmployeeCode: row.rawEmployeeCode,
          rawEmployeeName: row.rawEmployeeName,
          rawShift: row.rawShift,
          rawPlannedStart: row.rawPlannedStart,
          rawPlannedEnd: row.rawPlannedEnd,
          rawActualTimeIn: row.rawActualTimeIn,
          rawActualTimeOut: row.rawActualTimeOut,
          workedHours: row.workedHours,
          otHours: row.otHours,
          status: row.normalizedStatus || row.rawAttendanceStatus
        },
        systemEvidence: sysData.evidence,
        systemEvidenceFingerprint: sysData.fingerprint,
        resolvedStatus: row.normalizedStatus || row.rawAttendanceStatus || "PRESENT",
        resolvedTimeIn: row.actualTimeIn,
        resolvedTimeOut: row.actualTimeOut,
        resolvedWorkedMinutes: workedMins,
        resolvedOtMinutes: otMins,
        resolvedLeaveType: row.rawLeaveType,
        resolvedAssignmentType: row.rawAssignmentType,
        resolvedSiteId: row.siteId,
        isResolved: matchClass === "MATCHED",
        sources: []
      });
    }

    candidatesMap.get(opKey)!.sources.push({
      importRowId: row.id,
      sourceRowNumber: row.sourceRowNumber,
      sourceSheetName: null,
      sourceCellProvenance: `Row ${row.sourceRowNumber}`,
      rawPayload: row.rawPayload
    });
  }

  // Compute metrics across unique candidates
  let totalCandidates = candidatesMap.size;
  let matchedCandidates = 0;
  let warningCandidates = 0;
  let conflictCandidates = 0;
  let blockingCandidates = 0;
  let resolvedCandidates = 0;

  for (const c of candidatesMap.values()) {
    if (c.matchClassification === "MATCHED") matchedCandidates++;
    else if (c.matchClassification === "WARNING") warningCandidates++;
    else if (c.matchClassification === "CONFLICT") conflictCandidates++;
    else if (c.matchClassification === "BLOCKING") blockingCandidates++;
    if (c.isResolved) resolvedCandidates++;
  }

  return await prisma.$transaction(async tx => {
    const recBatch = await tx.attendanceReconciliationBatch.create({
      data: {
        batchNumber,
        importBatchId,
        companyId: importBatch.companyId!,
        operationType: importBatch.operationType!,
        periodYear,
        periodMonth,
        periodFrom: importBatch.attendancePeriodFrom,
        periodTo: importBatch.attendancePeriodTo,
        status: RECONCILIATION_STATUS.IN_REVIEW,
        reconciliationVersion: 1,
        sourceEvidenceHash,
        systemEvidenceHash,
        totalCandidates,
        matchedCandidates,
        warningCandidates,
        conflictCandidates,
        blockingCandidates,
        resolvedCandidates,
        excludedCandidates: 0,
        reviewerId: actor.id,
        reviewerName: actor.name || "Reviewer",
        reviewedAt: new Date(),
        events: {
          create: {
            reconciliationVersion: 1,
            actorId: actor.id,
            actorName: actor.name || "Reviewer",
            actorRole: actor.role || "OPERATIONS_MANAGER",
            eventType: "STARTED",
            eventPayload: { totalCandidates, matchedCandidates, conflictCandidates, blockingCandidates }
          }
        }
      }
    });

    for (const c of candidatesMap.values()) {
      const candidateRecord = await tx.attendanceReconciliationCandidate.create({
        data: {
          reconciliationBatchId: recBatch.id,
          operationalCandidateKey: c.candidateKey,
          evidenceOrigin: c.evidenceOrigin,
          evidenceSubtype: c.evidenceSubtype,
          employeeId: c.employeeId,
          dutyDate: c.dutyDate,
          siteId: c.siteId,
          contractId: c.contractId,
          shiftCode: c.shiftCode,
          rosterSlotAssignmentId: c.rosterSlotAssignmentId,
          matchClassification: c.matchClassification,
          conflictDetails: c.conflictDetails,
          importedEvidence: c.importedEvidence,
          systemEvidence: c.systemEvidence,
          systemEvidenceFingerprint: c.systemEvidenceFingerprint,
          isResolved: c.isResolved,
          sources: {
            create: c.sources.map(s => ({
              importRowId: s.importRowId,
              sourceRowNumber: s.sourceRowNumber,
              sourceSheetName: s.sourceSheetName,
              sourceCellProvenance: s.sourceCellProvenance,
              rawPayload: s.rawPayload
            }))
          }
        }
      });

      // Create Initial Decision v1
      const decisionV1 = await tx.attendanceReconciliationDecision.create({
        data: {
          reconciliationBatchId: recBatch.id,
          candidateId: candidateRecord.id,
          reconciliationVersion: 1,
          decisionVersion: 1,
          decisionType: c.matchClassification === "MATCHED" ? DECISION_TYPE.MATCHED_NO_ACTION : DECISION_TYPE.USE_IMPORTED_ATTENDANCE,
          resolvedStatus: c.resolvedStatus,
          resolvedTimeIn: c.resolvedTimeIn,
          resolvedTimeOut: c.resolvedTimeOut,
          resolvedWorkedMinutes: c.resolvedWorkedMinutes,
          resolvedOtMinutes: c.resolvedOtMinutes,
          resolvedLeaveType: c.resolvedLeaveType,
          resolvedAssignmentType: c.resolvedAssignmentType,
          resolvedSiteId: c.resolvedSiteId,
          decidedById: actor.id,
          decidedByName: actor.name || "System Auto-Match",
          decidedAt: new Date()
        }
      });

      await tx.attendanceReconciliationCandidate.update({
        where: { id: candidateRecord.id },
        data: { currentDecisionId: decisionV1.id }
      });
    }

    return await tx.attendanceReconciliationBatch.findUnique({
      where: { id: recBatch.id },
      include: {
        candidates: {
          include: {
            sources: true,
            currentDecision: true
          }
        },
        events: { orderBy: { createdAt: "desc" } }
      }
    });
  });
}

export async function applyDecision(
  reconciliationBatchId: string,
  decisionInput: {
    candidateId?: string;
    operationalCandidateKey?: string;
    decisionType: string;
    reasonCode?: string;
    reasonNotes?: string;
    resolvedStatus?: string;
    resolvedTimeIn?: Date | string | null;
    resolvedTimeOut?: Date | string | null;
    resolvedWorkedMinutes?: number;
    resolvedOtMinutes?: number;
    resolvedLeaveType?: string | null;
    resolvedAssignmentType?: string | null;
    resolvedSiteId?: string | null;
    resolvedRemarks?: string;
  },
  actor: { id: string; name?: string; role?: string }
): Promise<any> {
  const recBatch = await prisma.attendanceReconciliationBatch.findUnique({
    where: { id: reconciliationBatchId }
  });

  if (!recBatch) throw new Error("Reconciliation batch not found.");
  if (recBatch.status !== RECONCILIATION_STATUS.IN_REVIEW) {
    throw new Error(`Cannot edit decisions when reconciliation status is ${recBatch.status}. Only IN_REVIEW batches can be modified.`);
  }

  const candidate = await prisma.attendanceReconciliationCandidate.findFirst({
    where: decisionInput.candidateId
      ? { id: decisionInput.candidateId, reconciliationBatchId }
      : { reconciliationBatchId, operationalCandidateKey: decisionInput.operationalCandidateKey },
    include: { currentDecision: true }
  });

  if (!candidate) {
    throw new Error("Candidate record not found.");
  }

  if (decisionInput.decisionType !== DECISION_TYPE.MATCHED_NO_ACTION && !decisionInput.reasonCode) {
    throw new Error("Mandatory reason code is required when applying a manual reconciliation decision.");
  }

  const currentDecision = candidate.currentDecision;
  const nextDecisionVersion = currentDecision ? currentDecision.decisionVersion + 1 : 1;

  return await prisma.$transaction(async tx => {
    // Append-Only: Create New Decision Revision without mutating previous decision row!
    const newDecision = await tx.attendanceReconciliationDecision.create({
      data: {
        reconciliationBatchId,
        candidateId: candidate.id,
        reconciliationVersion: recBatch.reconciliationVersion,
        decisionVersion: nextDecisionVersion,
        supersedesDecisionId: currentDecision ? currentDecision.id : null,
        decisionType: decisionInput.decisionType,
        reasonCode: decisionInput.reasonCode || (currentDecision ? currentDecision.reasonCode : null),
        reasonNotes: decisionInput.reasonNotes || (currentDecision ? currentDecision.reasonNotes : null),
        resolvedStatus: decisionInput.resolvedStatus ?? (currentDecision ? currentDecision.resolvedStatus : "PRESENT"),
        resolvedTimeIn: decisionInput.resolvedTimeIn ? new Date(decisionInput.resolvedTimeIn) : (currentDecision ? currentDecision.resolvedTimeIn : null),
        resolvedTimeOut: decisionInput.resolvedTimeOut ? new Date(decisionInput.resolvedTimeOut) : (currentDecision ? currentDecision.resolvedTimeOut : null),
        resolvedWorkedMinutes: decisionInput.resolvedWorkedMinutes ?? (currentDecision ? currentDecision.resolvedWorkedMinutes : 0),
        resolvedOtMinutes: decisionInput.resolvedOtMinutes ?? (currentDecision ? currentDecision.resolvedOtMinutes : 0),
        resolvedLeaveType: decisionInput.resolvedLeaveType ?? (currentDecision ? currentDecision.resolvedLeaveType : null),
        resolvedAssignmentType: decisionInput.resolvedAssignmentType ?? (currentDecision ? currentDecision.resolvedAssignmentType : null),
        resolvedSiteId: decisionInput.resolvedSiteId ?? (currentDecision ? currentDecision.resolvedSiteId : null),
        resolvedRemarks: decisionInput.resolvedRemarks ?? (currentDecision ? currentDecision.resolvedRemarks : null),
        decidedById: actor.id,
        decidedByName: actor.name || "Reviewer",
        decidedAt: new Date()
      }
    });

    // Update mutable candidate overlay to point to new current decision
    await tx.attendanceReconciliationCandidate.update({
      where: { id: candidate.id },
      data: {
        currentDecisionId: newDecision.id,
        isResolved: decisionInput.decisionType !== DECISION_TYPE.EXCLUDE_ROW
      }
    });

    await tx.attendanceReconciliationEvent.create({
      data: {
        reconciliationBatchId,
        reconciliationVersion: recBatch.reconciliationVersion,
        actorId: actor.id,
        actorName: actor.name || "Reviewer",
        actorRole: actor.role || "OPERATIONS_MANAGER",
        eventType: "DECISION_APPLIED",
        eventPayload: {
          operationalCandidateKey: candidate.operationalCandidateKey,
          candidateId: candidate.id,
          decisionId: newDecision.id,
          decisionVersion: nextDecisionVersion,
          decisionType: decisionInput.decisionType,
          reasonCode: decisionInput.reasonCode
        }
      }
    });

    const activeCandidates = await tx.attendanceReconciliationCandidate.findMany({
      where: { reconciliationBatchId },
      include: { currentDecision: true }
    });

    const resolvedCount = activeCandidates.filter(c => c.isResolved && c.currentDecision?.decisionType !== DECISION_TYPE.EXCLUDE_ROW).length;
    const excludedCount = activeCandidates.filter(c => c.currentDecision?.decisionType === DECISION_TYPE.EXCLUDE_ROW || c.currentDecision?.decisionType === DECISION_TYPE.EXCLUDE_DUPLICATE).length;

    await tx.attendanceReconciliationBatch.update({
      where: { id: reconciliationBatchId },
      data: {
        resolvedCandidates: resolvedCount,
        excludedCandidates: excludedCount,
        reviewerId: actor.id,
        reviewerName: actor.name || "Reviewer",
        reviewedAt: new Date(),
        rowVersion: { increment: 1 }
      }
    });

    return newDecision;
  });
}

export async function completeReview(reconciliationBatchId: string, actor: { id: string; name?: string; role?: string }): Promise<any> {
  const recBatch = await prisma.attendanceReconciliationBatch.findUnique({
    where: { id: reconciliationBatchId },
    include: { candidates: { include: { currentDecision: true } } }
  });

  if (!recBatch) throw new Error("Reconciliation batch not found.");
  if (recBatch.status !== RECONCILIATION_STATUS.IN_REVIEW) {
    throw new Error(`Cannot complete review from status ${recBatch.status}. Expected IN_REVIEW.`);
  }

  const unresolvedBlocking = recBatch.candidates.filter(c => c.matchClassification === "BLOCKING" && !c.isResolved);
  if (unresolvedBlocking.length > 0) {
    throw new Error(`Cannot complete review: ${unresolvedBlocking.length} blocking conflict(s) remain unresolved.`);
  }

  const latestSourceHash = await calculateSourceEvidenceHash(recBatch.importBatchId);
  if (recBatch.sourceEvidenceHash && recBatch.sourceEvidenceHash !== latestSourceHash) {
    throw new Error("RECONCILIATION_SOURCE_CHANGED: Raw staging evidence changed after reconciliation evaluation. Review required.");
  }

  return await prisma.$transaction(async tx => {
    const updated = await tx.attendanceReconciliationBatch.update({
      where: { id: reconciliationBatchId },
      data: {
        status: RECONCILIATION_STATUS.REVIEW_COMPLETE,
        reviewedAt: new Date(),
        reviewerId: actor.id,
        reviewerName: actor.name || "Reviewer",
        rowVersion: { increment: 1 }
      }
    });

    await tx.attendanceReconciliationEvent.create({
      data: {
        reconciliationBatchId,
        reconciliationVersion: recBatch.reconciliationVersion,
        actorId: actor.id,
        actorName: actor.name || "Reviewer",
        actorRole: actor.role || "OPERATIONS_MANAGER",
        eventType: "REVIEW_COMPLETED",
        eventPayload: { resolvedCandidates: recBatch.resolvedCandidates, totalCandidates: recBatch.totalCandidates }
      }
    });

    return updated;
  });
}

export async function submitForApproval(reconciliationBatchId: string, actor: { id: string; name?: string; role?: string }): Promise<any> {
  const recBatch = await prisma.attendanceReconciliationBatch.findUnique({
    where: { id: reconciliationBatchId },
    include: { candidates: { include: { currentDecision: true } } }
  });

  if (!recBatch) throw new Error("Reconciliation batch not found.");
  if (recBatch.status !== RECONCILIATION_STATUS.REVIEW_COMPLETE && recBatch.status !== RECONCILIATION_STATUS.IN_REVIEW) {
    throw new Error(`Cannot submit for approval from status ${recBatch.status}. Expected REVIEW_COMPLETE.`);
  }

  const unresolvedBlocking = recBatch.candidates.filter(c => c.matchClassification === "BLOCKING" && !c.isResolved);
  if (unresolvedBlocking.length > 0) {
    throw new Error(`Cannot submit for approval: ${unresolvedBlocking.length} blocking conflict(s) remain unresolved.`);
  }

  const latestSourceHash = await calculateSourceEvidenceHash(recBatch.importBatchId);
  if (recBatch.sourceEvidenceHash && recBatch.sourceEvidenceHash !== latestSourceHash) {
    throw new Error("RECONCILIATION_SOURCE_CHANGED: Raw staging evidence changed after reconciliation evaluation. Review required.");
  }

  return await prisma.$transaction(async tx => {
    const updated = await tx.attendanceReconciliationBatch.update({
      where: { id: reconciliationBatchId },
      data: {
        status: RECONCILIATION_STATUS.PENDING_APPROVAL,
        submittedById: actor.id,
        submittedByName: actor.name || "Submitter",
        submittedAt: new Date(),
        rowVersion: { increment: 1 }
      }
    });

    await tx.attendanceReconciliationEvent.create({
      data: {
        reconciliationBatchId,
        reconciliationVersion: recBatch.reconciliationVersion,
        actorId: actor.id,
        actorName: actor.name || "Submitter",
        actorRole: actor.role || "OPERATIONS_MANAGER",
        eventType: "SUBMITTED",
        eventPayload: { submittedAt: new Date() }
      }
    });

    return updated;
  });
}

export async function returnReconciliation(
  reconciliationBatchId: string,
  returnReason: string,
  actor: { id: string; name?: string; role?: string }
): Promise<any> {
  if (!returnReason || returnReason.trim().length === 0) {
    throw new Error("Mandatory return reason is required to return reconciliation batch.");
  }

  const recBatch = await prisma.attendanceReconciliationBatch.findUnique({
    where: { id: reconciliationBatchId }
  });

  if (!recBatch) throw new Error("Reconciliation batch not found.");
  if (recBatch.status !== RECONCILIATION_STATUS.PENDING_APPROVAL) {
    throw new Error(`Cannot return batch from status ${recBatch.status}. Expected PENDING_APPROVAL.`);
  }

  return await prisma.$transaction(async tx => {
    const updated = await tx.attendanceReconciliationBatch.update({
      where: { id: reconciliationBatchId },
      data: {
        status: RECONCILIATION_STATUS.RETURNED,
        returnReason: returnReason.trim(),
        rowVersion: { increment: 1 }
      }
    });

    await tx.attendanceReconciliationEvent.create({
      data: {
        reconciliationBatchId,
        reconciliationVersion: recBatch.reconciliationVersion,
        actorId: actor.id,
        actorName: actor.name || "Approver",
        actorRole: actor.role || "HR_DIRECTOR",
        eventType: "RETURNED",
        eventPayload: { returnReason: returnReason.trim() }
      }
    });

    return updated;
  });
}

export async function resumeReturnedReview(reconciliationBatchId: string, actor: { id: string; name?: string; role?: string }): Promise<any> {
  const recBatch = await prisma.attendanceReconciliationBatch.findUnique({
    where: { id: reconciliationBatchId }
  });

  if (!recBatch) throw new Error("Reconciliation batch not found.");
  if (recBatch.status !== RECONCILIATION_STATUS.RETURNED) {
    throw new Error(`Cannot resume review from status ${recBatch.status}. Expected RETURNED.`);
  }

  return await prisma.$transaction(async tx => {
    const updated = await tx.attendanceReconciliationBatch.update({
      where: { id: reconciliationBatchId },
      data: {
        status: RECONCILIATION_STATUS.IN_REVIEW,
        rowVersion: { increment: 1 }
      }
    });

    await tx.attendanceReconciliationEvent.create({
      data: {
        reconciliationBatchId,
        reconciliationVersion: recBatch.reconciliationVersion,
        actorId: actor.id,
        actorName: actor.name || "Reviewer",
        actorRole: actor.role || "OPERATIONS_MANAGER",
        eventType: "REVIEW_RESUMED",
        eventPayload: { resumedAt: new Date() }
      }
    });

    return updated;
  });
}

export async function refreshEvidence(reconciliationBatchId: string, actor: { id: string; name?: string; role?: string }): Promise<any> {
  const recBatch = await prisma.attendanceReconciliationBatch.findUnique({
    where: { id: reconciliationBatchId },
    include: {
      candidates: { include: { currentDecision: true } }
    }
  });

  if (!recBatch) throw new Error("Reconciliation batch not found.");
  if (recBatch.status !== RECONCILIATION_STATUS.IN_REVIEW && recBatch.status !== RECONCILIATION_STATUS.RETURNED) {
    throw new Error(`Cannot refresh evidence from status ${recBatch.status}. Expected IN_REVIEW or RETURNED.`);
  }

  const employeeIds: string[] = [];
  const validDates: Date[] = [];
  for (const c of recBatch.candidates) {
    if (c.employeeId && !employeeIds.includes(c.employeeId)) employeeIds.push(c.employeeId);
    if (c.dutyDate) validDates.push(c.dutyDate);
  }

  const [newSourceHash, { systemEvidenceHash: newSystemHash, fingerprintsByCandidate }] = await Promise.all([
    calculateSourceEvidenceHash(recBatch.importBatchId),
    calculateSystemEvidence(recBatch.companyId, recBatch.operationType, employeeIds, validDates)
  ]);

  return await prisma.$transaction(async tx => {
    for (const c of recBatch.candidates) {
      const dutyDateStr = c.dutyDate ? c.dutyDate.toISOString().slice(0, 10) : "NODATE";
      const sysKey = `${c.employeeId || 'NOEMP'}_${dutyDateStr}`;
      const sysData = fingerprintsByCandidate[sysKey];

      if (sysData && sysData.fingerprint !== c.systemEvidenceFingerprint) {
        await tx.attendanceReconciliationCandidate.update({
          where: { id: c.id },
          data: {
            systemEvidence: sysData.evidence,
            systemEvidenceFingerprint: sysData.fingerprint,
            isResolved: false
          }
        });
      }
    }

    const updatedBatch = await tx.attendanceReconciliationBatch.update({
      where: { id: reconciliationBatchId },
      data: {
        sourceEvidenceHash: newSourceHash,
        systemEvidenceHash: newSystemHash,
        rowVersion: { increment: 1 }
      }
    });

    await tx.attendanceReconciliationEvent.create({
      data: {
        reconciliationBatchId,
        reconciliationVersion: recBatch.reconciliationVersion,
        actorId: actor.id,
        actorName: actor.name || "Reviewer",
        actorRole: actor.role || "OPERATIONS_MANAGER",
        eventType: "EVIDENCE_REFRESHED",
        eventPayload: { sourceEvidenceHash: newSourceHash, systemEvidenceHash: newSystemHash }
      }
    });

    return updatedBatch;
  });
}

export async function rejectReconciliation(
  reconciliationBatchId: string,
  rejectionReason: string,
  actor: { id: string; name?: string; role?: string }
): Promise<any> {
  if (!rejectionReason || rejectionReason.trim().length === 0) {
    throw new Error("Mandatory rejection reason is required to reject reconciliation batch.");
  }

  const recBatch = await prisma.attendanceReconciliationBatch.findUnique({
    where: { id: reconciliationBatchId }
  });

  if (!recBatch) throw new Error("Reconciliation batch not found.");
  if (recBatch.status !== RECONCILIATION_STATUS.PENDING_APPROVAL) {
    throw new Error(`Cannot reject batch from status ${recBatch.status}. Expected PENDING_APPROVAL.`);
  }

  return await prisma.$transaction(async tx => {
    const updated = await tx.attendanceReconciliationBatch.update({
      where: { id: reconciliationBatchId },
      data: {
        status: RECONCILIATION_STATUS.REJECTED,
        rejectionReason: rejectionReason.trim(),
        rowVersion: { increment: 1 }
      }
    });

    await tx.attendanceReconciliationEvent.create({
      data: {
        reconciliationBatchId,
        reconciliationVersion: recBatch.reconciliationVersion,
        actorId: actor.id,
        actorName: actor.name || "Approver",
        actorRole: actor.role || "HR_DIRECTOR",
        eventType: "REJECTED",
        eventPayload: { rejectionReason: rejectionReason.trim() }
      }
    });

    return updated;
  });
}

export async function approveReconciliation(reconciliationBatchId: string, actor: { id: string; name?: string; role?: string }): Promise<any> {
  const recBatch = await prisma.attendanceReconciliationBatch.findUnique({
    where: { id: reconciliationBatchId },
    include: {
      importBatch: { select: { id: true, batchNumber: true, uploadedById: true } },
      candidates: {
        include: {
          currentDecision: true,
          employee: true,
          site: true,
          contract: true,
          sources: true
        }
      }
    }
  });

  if (!recBatch) throw new Error("Reconciliation batch not found.");
  if (recBatch.status !== RECONCILIATION_STATUS.PENDING_APPROVAL) {
    throw new Error(`Cannot approve batch from status ${recBatch.status}. Expected PENDING_APPROVAL.`);
  }

  // Segregation of Duties Enforcement (No role, including SUPER_ADMIN, can self-approve)
  const isUploader = actor.id === recBatch.importBatch.uploadedById;
  const isBatchReviewer = actor.id === recBatch.reviewerId;
  const isSubmitter = actor.id === recBatch.submittedById;

  const decidingActorInActiveVersion = await prisma.attendanceReconciliationDecision.findFirst({
    where: {
      reconciliationBatchId: recBatch.id,
      reconciliationVersion: recBatch.reconciliationVersion,
      decidedById: actor.id
    }
  });

  if (isUploader || isBatchReviewer || isSubmitter || decidingActorInActiveVersion) {
    throw new Error("Segregation of Duties Violation: Approver cannot be the batch uploader, reviewer, submitter, or any decidedById actor in the active reconciliation version.");
  }

  // Re-verify drift fingerprints
  const latestSourceHash = await calculateSourceEvidenceHash(recBatch.importBatchId);
  const employeeIds: string[] = [];
  const validDates: Date[] = [];
  for (const c of recBatch.candidates) {
    if (c.employeeId && !employeeIds.includes(c.employeeId)) employeeIds.push(c.employeeId);
    if (c.dutyDate) validDates.push(c.dutyDate);
  }

  const { systemEvidenceHash: latestSystemHash } = await calculateSystemEvidence(
    recBatch.companyId,
    recBatch.operationType,
    employeeIds,
    validDates
  );

  const sourceDrifted = recBatch.sourceEvidenceHash && recBatch.sourceEvidenceHash !== latestSourceHash;
  const systemDrifted = recBatch.systemEvidenceHash && recBatch.systemEvidenceHash !== latestSystemHash;

  // Handle Approval Drift Transaction Semantics: Persist RETURNED state and do not create snapshot!
  if (sourceDrifted || systemDrifted) {
    const driftReason = sourceDrifted ? "RECONCILIATION_SOURCE_CHANGED" : "RECONCILIATION_EVIDENCE_CHANGED";

    await prisma.$transaction(async tx => {
      await tx.attendanceReconciliationBatch.update({
        where: { id: reconciliationBatchId },
        data: {
          status: RECONCILIATION_STATUS.RETURNED,
          returnReason: driftReason,
          rowVersion: { increment: 1 }
        }
      });

      await tx.attendanceReconciliationEvent.create({
        data: {
          reconciliationBatchId,
          reconciliationVersion: recBatch.reconciliationVersion,
          actorId: actor.id,
          actorName: actor.name || "Approver",
          actorRole: actor.role || "HR_DIRECTOR",
          eventType: "RETURNED",
          eventPayload: { driftReason, sourceDrifted, systemDrifted }
        }
      });
    });

    throw new Error(`Approval blocked due to evidence drift. Batch has been transitioned to RETURNED (${driftReason}). Reviewer must resume and refresh evidence.`);
  }

  const nextApprovalVersion = recBatch.currentApprovalVersion + 1;
  const snapshotRowsData: any[] = [];
  const rowChecksums: string[] = [];

  let approvedRegularMinutesTotal = 0;
  let approvedOtMinutesTotal = 0;

  for (const candidate of recBatch.candidates) {
    const dec = candidate.currentDecision;
    if (!dec || dec.decisionType === DECISION_TYPE.EXCLUDE_ROW || dec.decisionType === DECISION_TYPE.EXCLUDE_DUPLICATE) {
      continue;
    }

    if (dec.reconciliationVersion !== recBatch.reconciliationVersion) {
      throw new Error(`Approval invariant violation: Candidate ${candidate.operationalCandidateKey} references decision version ${dec.reconciliationVersion} but batch is on reconciliationVersion ${recBatch.reconciliationVersion}.`);
    }

    const regMinutes = dec.resolvedWorkedMinutes || 0;
    const otMinutes = dec.resolvedOtMinutes || 0;
    approvedRegularMinutesTotal += regMinutes;
    approvedOtMinutesTotal += otMinutes;

    const empCode = candidate.employee?.id || (candidate.importedEvidence as any)?.rawEmployeeCode || candidate.employeeId || "UNKNOWN";
    const empName = candidate.employee ? candidate.employee.name : ((candidate.importedEvidence as any)?.rawEmployeeName || "UNKNOWN");
    const siteName = candidate.site?.name || (candidate.importedEvidence as any)?.rawSite || null;
    const contractNum = candidate.contract?.contractNumber || (candidate.importedEvidence as any)?.rawContract || null;
    const primarySource = candidate.sources.length > 0 ? candidate.sources[0] : null;

    const rowSum = computeRowChecksum({
      operationalCandidateKey: candidate.operationalCandidateKey,
      employeeId: candidate.employeeId,
      employeeCode: empCode,
      employeeName: empName,
      companyId: recBatch.companyId,
      operationType: recBatch.operationType,
      dutyDate: candidate.dutyDate || new Date(),
      siteId: candidate.siteId,
      siteName,
      contractId: candidate.contractId,
      contractNumber: contractNum,
      rosterSlotAssignmentId: candidate.rosterSlotAssignmentId,
      shiftCode: candidate.shiftCode,
      plannedStart: (candidate.importedEvidence as any)?.rawPlannedStart || null,
      plannedEnd: (candidate.importedEvidence as any)?.rawPlannedEnd || null,
      actualTimeIn: dec.resolvedTimeIn,
      actualTimeOut: dec.resolvedTimeOut,
      approvedStatus: dec.resolvedStatus,
      approvedRegularMinutes: regMinutes,
      approvedOtMinutes: otMinutes,
      approvedLeaveType: dec.resolvedLeaveType,
      approvedAssignmentType: dec.resolvedAssignmentType,
      reconciliationDecisionId: dec.id,
      decisionType: dec.decisionType,
      reasonCode: dec.reasonCode,
      reasonNotes: dec.reasonNotes
    });

    rowChecksums.push(rowSum);

    snapshotRowsData.push({
      reconciliationBatchId: recBatch.id,
      importBatchId: recBatch.importBatchId,
      importRowId: primarySource?.importRowId || null,
      approvalVersion: nextApprovalVersion,
      sourceRowNumber: primarySource?.sourceRowNumber || null,
      operationalCandidateKey: candidate.operationalCandidateKey,
      employeeId: candidate.employeeId || empCode,
      employeeCode: empCode,
      employeeName: empName,
      companyId: recBatch.companyId,
      operationType: recBatch.operationType,
      siteId: candidate.siteId,
      siteName,
      contractId: candidate.contractId,
      contractNumber: contractNum,
      rosterSlotAssignmentId: candidate.rosterSlotAssignmentId,
      shiftCode: candidate.shiftCode,
      dutyDate: candidate.dutyDate || new Date(),
      plannedStart: (candidate.importedEvidence as any)?.rawPlannedStart || null,
      plannedEnd: (candidate.importedEvidence as any)?.rawPlannedEnd || null,
      actualTimeIn: dec.resolvedTimeIn,
      actualTimeOut: dec.resolvedTimeOut,
      approvedStatus: dec.resolvedStatus,
      approvedRegularMinutes: regMinutes,
      approvedOtMinutes: otMinutes,
      approvedLeaveType: dec.resolvedLeaveType,
      approvedAssignmentType: dec.resolvedAssignmentType,
      reconciliationDecisionId: dec.id,
      decisionType: dec.decisionType,
      reasonCode: dec.reasonCode,
      reasonNotes: dec.reasonNotes,
      rowChecksum: rowSum
    });
  }

  rowChecksums.sort();
  const snapshotHash = computeSnapshotHash({
    reconciliationBatchId: recBatch.id,
    approvalVersion: nextApprovalVersion,
    reconciliationVersion: recBatch.reconciliationVersion,
    sourceImportBatchId: recBatch.importBatchId,
    sourceEvidenceHash: recBatch.sourceEvidenceHash || latestSourceHash,
    systemEvidenceHash: recBatch.systemEvidenceHash || latestSystemHash,
    totalRows: snapshotRowsData.length,
    approvedRegularMinutesTotal,
    approvedOtMinutesTotal
  }, rowChecksums);

  return await prisma.$transaction(async tx => {
    const snapshot = await tx.attendanceApprovedSnapshot.create({
      data: {
        reconciliationBatchId: recBatch.id,
        approvalVersion: nextApprovalVersion,
        reconciliationVersion: recBatch.reconciliationVersion,
        sourceImportBatchId: recBatch.importBatchId,
        sourceImportBatchNumber: recBatch.importBatch.batchNumber,
        companyId: recBatch.companyId,
        operationType: recBatch.operationType,
        periodFrom: recBatch.periodFrom,
        periodTo: recBatch.periodTo,
        sourceEvidenceHash: recBatch.sourceEvidenceHash || latestSourceHash,
        systemEvidenceHash: recBatch.systemEvidenceHash || latestSystemHash,
        snapshotHash,
        totalRows: snapshotRowsData.length,
        approvedRegularMinutesTotal,
        approvedOtMinutesTotal,
        approvedById: actor.id,
        approvedByName: actor.name || "Approver",
        approvedByRole: actor.role || "HR_DIRECTOR",
        approvedAt: new Date(),
        snapshotRows: {
          create: snapshotRowsData
        }
      },
      include: {
        snapshotRows: true
      }
    });

    const updatedBatch = await tx.attendanceReconciliationBatch.update({
      where: { id: reconciliationBatchId },
      data: {
        status: RECONCILIATION_STATUS.APPROVED,
        currentApprovalVersion: nextApprovalVersion,
        approverId: actor.id,
        approverName: actor.name || "Approver",
        approvedAt: new Date(),
        rowVersion: { increment: 1 }
      }
    });

    await tx.attendanceReconciliationEvent.create({
      data: {
        reconciliationBatchId,
        reconciliationVersion: recBatch.reconciliationVersion,
        actorId: actor.id,
        actorName: actor.name || "Approver",
        actorRole: actor.role || "HR_DIRECTOR",
        eventType: "APPROVED",
        eventPayload: {
          approvalVersion: nextApprovalVersion,
          snapshotId: snapshot.id,
          snapshotHash,
          totalApprovedRows: snapshotRowsData.length,
          approvedRegularMinutesTotal,
          approvedOtMinutesTotal
        }
      }
    });

    return { batch: updatedBatch, snapshot };
  });
}

export async function reopenReconciliation(
  reconciliationBatchId: string,
  reopenReason: string,
  actor: { id: string; name?: string; role?: string }
): Promise<any> {
  if (!reopenReason || reopenReason.trim().length === 0) {
    throw new Error("Mandatory reopen reason is required to reopen an approved reconciliation batch.");
  }

  const recBatch = await prisma.attendanceReconciliationBatch.findUnique({
    where: { id: reconciliationBatchId },
    include: {
      candidates: { include: { currentDecision: true } },
      snapshots: { orderBy: { approvalVersion: "desc" }, take: 1 }
    }
  });

  if (!recBatch) throw new Error("Reconciliation batch not found.");
  if (recBatch.status !== RECONCILIATION_STATUS.APPROVED) {
    throw new Error(`Cannot reopen batch from status ${recBatch.status}. Expected APPROVED.`);
  }

  const nextReconciliationVersion = recBatch.reconciliationVersion + 1;

  return await prisma.$transaction(async tx => {
    for (const c of recBatch.candidates) {
      const v1Decision = c.currentDecision;
      if (v1Decision) {
        const v2Decision = await tx.attendanceReconciliationDecision.create({
          data: {
            reconciliationBatchId,
            candidateId: c.id,
            reconciliationVersion: nextReconciliationVersion,
            decisionVersion: 1,
            supersedesDecisionId: v1Decision.id,
            decisionType: v1Decision.decisionType,
            reasonCode: v1Decision.reasonCode,
            reasonNotes: v1Decision.reasonNotes,
            resolvedStatus: v1Decision.resolvedStatus,
            resolvedTimeIn: v1Decision.resolvedTimeIn,
            resolvedTimeOut: v1Decision.resolvedTimeOut,
            resolvedWorkedMinutes: v1Decision.resolvedWorkedMinutes,
            resolvedOtMinutes: v1Decision.resolvedOtMinutes,
            resolvedLeaveType: v1Decision.resolvedLeaveType,
            resolvedAssignmentType: v1Decision.resolvedAssignmentType,
            resolvedSiteId: v1Decision.resolvedSiteId,
            resolvedRemarks: v1Decision.resolvedRemarks,
            decidedById: actor.id,
            decidedByName: actor.name || "Reopen Carry-Forward",
            decidedAt: new Date()
          }
        });

        await tx.attendanceReconciliationCandidate.update({
          where: { id: c.id },
          data: { currentDecisionId: v2Decision.id }
        });
      }
    }

    const updated = await tx.attendanceReconciliationBatch.update({
      where: { id: reconciliationBatchId },
      data: {
        status: RECONCILIATION_STATUS.IN_REVIEW,
        reconciliationVersion: nextReconciliationVersion,
        rowVersion: { increment: 1 }
      }
    });

    await tx.attendanceReconciliationEvent.create({
      data: {
        reconciliationBatchId,
        reconciliationVersion: nextReconciliationVersion,
        actorId: actor.id,
        actorName: actor.name || "Reviewer",
        actorRole: actor.role || "OPERATIONS_MANAGER",
        eventType: "REOPENED",
        eventPayload: {
          previousReconciliationVersion: recBatch.reconciliationVersion,
          newReconciliationVersion: nextReconciliationVersion,
          reopenReason: reopenReason.trim(),
          preservedSnapshotId: recBatch.snapshots[0]?.id
        }
      }
    });

    return updated;
  });
}