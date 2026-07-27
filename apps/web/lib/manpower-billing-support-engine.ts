import { prisma } from "@ahh-wfm/database";

export interface BillingSupportCalculationParams {
  operationType: "SECURITY_GUARDING" | "FACILITY_MANAGEMENT";
  period: string;        // "YYYY-MM"
  clientId?: string;
  contractId?: string;
  projectId?: string;
  siteId?: string;
  companyId?: string;
  calculatedBy: string;
  idempotencyKey?: string;
  requestHash?: string;
  correlationId?: string;
}

export interface CalculatedBillingLine {
  businessDate: string;
  clientId: string | null;
  clientNameSnapshot: string;
  contractId: string | null;
  contractCodeSnapshot: string;
  projectId: string | null;
  projectNameSnapshot: string;
  siteId: string | null;
  siteNameSnapshot: string;
  shiftRequirementId?: string | null;
  requirementSeriesId?: string | null;
  requirementSlotId: string | null;
  locationUnitId?: string | null;
  postId?: string | null;
  zoneId?: string | null;
  requiredPositionCategoryId?: string | null;
  positionCategory: string | null;
  slotIndex?: number | null;
  publicationId?: string | null;
  assignmentId?: string | null;
  attendanceId?: string | null;
  reconciliationId?: string | null;
  plannedManpower: number;
  plannedPostMinutes: number;
  assignedManpower: number;
  verifiedPresentManpower: number;
  verifiedAttendedMinutes: number;
  coveredPostMinutes: number;
  shortageCount: number;
  unapprovedExtraCount: number;
  approvedExtraCount: number;
  relieverSubstitutionCount: number;
  focRelieverMinutes: number;
  baseBillableAdvisoryQty: number;
  additionalRelieverAdvisoryQty: number;
  billableAdvisoryQuantity: number;
  billingBasis: "PLANNED_VS_ACTUAL_ATTENDANCE" | "PLANNED_POST_CONTRACT" | "SHIFT_RATE" | "HOURLY_RATE" | "MONTHLY_LUMP_SUM" | "COMMERCIAL_RULE_NOT_CONFIGURED";
  warningCodes: string[];
  notes: string;
  contractEvidenceJson?: any;
}

/**
 * Validates scope key consistency with companyId.
 */
export function calculateRunScopeKey(companyId?: string | null): string {
  return companyId ? `COMPANY:${companyId}` : "GLOBAL";
}

export function validateScopeKeyConsistency(runScopeKey: string, companyId?: string | null): void {
  if (runScopeKey === "GLOBAL" && companyId) {
    throw new Error("INVALID_SCOPE_KEY: GLOBAL scopeKey requires companyId to be null");
  }
  if (runScopeKey.startsWith("COMPANY:") && runScopeKey !== `COMPANY:${companyId}`) {
    throw new Error("INVALID_SCOPE_KEY: COMPANY scopeKey must match companyId exactly");
  }
}

/**
 * Maps contract billing basis string to ManpowerBillingBasis enum.
 */
export function resolveBillingBasis(basis?: string | null): "PLANNED_VS_ACTUAL_ATTENDANCE" | "PLANNED_POST_CONTRACT" | "SHIFT_RATE" | "HOURLY_RATE" | "MONTHLY_LUMP_SUM" | "COMMERCIAL_RULE_NOT_CONFIGURED" {
  if (!basis) return "COMMERCIAL_RULE_NOT_CONFIGURED";
  const b = basis.toUpperCase();
  if (b.includes("PLANNED_POST")) return "PLANNED_POST_CONTRACT";
  if (b.includes("SHIFT")) return "SHIFT_RATE";
  if (b.includes("HOURLY")) return "HOURLY_RATE";
  if (b.includes("MONTHLY") || b.includes("LUMP")) return "MONTHLY_LUMP_SUM";
  if (b.includes("PLANNED_VS_ACTUAL") || b.includes("ATTENDANCE")) return "PLANNED_VS_ACTUAL_ATTENDANCE";
  return "COMMERCIAL_RULE_NOT_CONFIGURED";
}

/**
 * Calculates MP-3C Client Billing Support Advisory data.
 */
export async function calculateBillingSupportData(
  params: BillingSupportCalculationParams
): Promise<{ lines: CalculatedBillingLine[]; summary: any; sourceVersionJson: any }> {
  const year = parseInt(params.period.split("-")[0]);
  const month = parseInt(params.period.split("-")[1]);
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  // Fetch active profiles and calendar versions for source tracking
  const activeProfiles = await prisma.manpowerWorkCalendarProfile.findMany({
    where: {
      operationType: params.operationType,
      approvalStatus: "APPROVED",
      ...(params.companyId ? { companyId: params.companyId } : {})
    },
    orderBy: { version: "desc" }
  });

  const activeRamadan = await prisma.manpowerRamadanPeriod.findFirst({
    where: { year, approvalStatus: "APPROVED" },
    orderBy: { version: "desc" }
  });

  const activeHolidayCal = await prisma.manpowerHolidayCalendar.findFirst({
    where: {
      year,
      approvalStatus: "APPROVED",
      scope: { in: [params.operationType as any, "BOTH"] },
      ...(params.companyId ? { OR: [{ companyId: params.companyId }, { companyId: null }] } : {})
    },
    orderBy: { version: "desc" }
  });

  const sourceVersionJson = {
    workCalendarProfiles: activeProfiles.map(p => ({ id: p.id, code: p.code, version: p.version, workerCategory: p.workerCategory })),
    ramadanPeriod: activeRamadan ? { id: activeRamadan.id, version: activeRamadan.version, year: activeRamadan.year } : null,
    holidayCalendar: activeHolidayCal ? { id: activeHolidayCal.id, version: activeHolidayCal.version, year: activeHolidayCal.year } : null,
    calculationEngineVersion: 3,
    calculatedAt: new Date().toISOString()
  };

  // 1. Fetch Requirements & Contracts
  const requirements = await prisma.contractManpowerRequirement.findMany({
    where: {
      contract: {
        operationType: params.operationType,
        ...(params.clientId ? { clientId: params.clientId } : {}),
        ...(params.contractId ? { id: params.contractId } : {})
      }
    },
    include: {
      contract: { include: { client: true, site: { include: { project: true } } } },
      rosterSlots: true
    }
  });

  // 2. Fetch Assignments
  const assignments = await prisma.rosterSlotAssignment.findMany({
    where: {
      slot: {
        contract: {
          operationType: params.operationType,
          ...(params.clientId ? { clientId: params.clientId } : {}),
          ...(params.contractId ? { id: params.contractId } : {})
        },
        ...(params.siteId ? { siteId: params.siteId } : {}),
        businessDate: { gte: start, lte: end }
      }
    },
    include: {
      slot: {
        include: {
          contract: { include: { client: true } },
          site: { include: { project: true } }
        }
      },
      employee: true
    }
  });

  // 3. Fetch Verified Attendance
  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: {
      checkIn: { gte: start, lte: end },
      employee: { operationType: params.operationType }
    }
  });

  const lines: CalculatedBillingLine[] = [];
  let totalPlannedManpower = 0;
  let totalAssignedManpower = 0;
  let totalVerifiedPresent = 0;
  let totalBillableQuantity = 0;

  // Group by (siteId, requirementSlotId, businessDate)
  const dateMap = new Map<string, { slots: any[]; asgs: any[] }>();

  assignments.forEach((asg: any) => {
    const dStr = asg.slot.businessDate.toISOString().split("T")[0];
    const key = `${asg.slot.siteId || "NO_SITE"}:${asg.slotId}:${dStr}`;
    if (!dateMap.has(key)) {
      dateMap.set(key, { slots: [asg.slot], asgs: [] });
    }
    dateMap.get(key)!.asgs.push(asg);
  });

  requirements.forEach((req: any) => {
    (req.rosterSlots || []).forEach((slot: any) => {
      const dStr = slot.businessDate.toISOString().split("T")[0];
      const key = `${slot.siteId || "NO_SITE"}:${slot.id}:${dStr}`;
      if (!dateMap.has(key)) {
        dateMap.set(key, { slots: [slot], asgs: [] });
      }
    });
  });

  dateMap.forEach(({ slots, asgs }, key) => {
    const slot = slots[0];
    const dStr = key.split(":")[2];
    const plannedManpower = slot ? 1 : 0;
    const plannedPostMinutes = 480;

    let assignedManpower = 0;
    let verifiedPresentManpower = 0;
    let verifiedAttendedMinutes = 0;
    let relieverSubstitutionCount = 0;
    let focRelieverMinutes = 0;
    let firstAssignmentId: string | null = null;
    let firstAttendanceId: string | null = null;
    const warnings: string[] = [];

    asgs.forEach((asg: any) => {
      if (!firstAssignmentId) firstAssignmentId = asg.id;
      if (asg.assignmentType === "RELIEVER") {
        relieverSubstitutionCount++;
        if (slot?.contract?.isFoc || (asg.notes && asg.notes.includes("FOC"))) {
          focRelieverMinutes += plannedPostMinutes;
        }
      } else {
        assignedManpower++;
      }

      const att = attendanceRecords.find(
        a => a.employeeId === asg.employeeId && a.checkIn.toISOString().split("T")[0] === dStr
      );

      if (att && att.checkIn && att.checkOut) {
        if (!firstAttendanceId) firstAttendanceId = att.id;
        verifiedPresentManpower++;
        const mins = Math.round((att.checkOut.getTime() - att.checkIn.getTime()) / (1000 * 60));
        verifiedAttendedMinutes += mins;
      } else if (att) {
        if (!firstAttendanceId) firstAttendanceId = att.id;
        verifiedPresentManpower++;
        verifiedAttendedMinutes += plannedPostMinutes;
      }
    });

    const totalCoveredCount = assignedManpower + relieverSubstitutionCount;
    const coveredPostMinutes = Math.min(verifiedAttendedMinutes, plannedPostMinutes);
    const shortageCount = Math.max(0, plannedManpower - totalCoveredCount);
    const unapprovedExtraCount = Math.max(0, totalCoveredCount - plannedManpower);
    const approvedExtraCount = 0;

    if (shortageCount > 0) warnings.push("UNDER_DEPLOYMENT_SHORTAGE");
    if (unapprovedExtraCount > 0) warnings.push("UNAPPROVED_EXTRA_DEPLOYMENT");
    if (focRelieverMinutes > 0) warnings.push("FOC_RELIEVER_APPLIED");

    const baseBillableAdvisoryQty = Math.min(plannedManpower, verifiedPresentManpower);
    const additionalRelieverAdvisoryQty = 0;
    const billableAdvisoryQuantity = baseBillableAdvisoryQty + additionalRelieverAdvisoryQty;

    const bBasis = resolveBillingBasis(slot?.contract?.billingBasis);
    if (bBasis === "COMMERCIAL_RULE_NOT_CONFIGURED") {
      warnings.push("COMMERCIAL_RULE_NOT_CONFIGURED");
    }

    totalPlannedManpower += plannedManpower;
    totalAssignedManpower += assignedManpower;
    totalVerifiedPresent += verifiedPresentManpower;
    totalBillableQuantity += billableAdvisoryQuantity;

    lines.push({
      businessDate: dStr,
      clientId: slot?.contract?.clientId || null,
      clientNameSnapshot: slot?.contract?.client?.name || slot?.contract?.client?.clientName || "Client",
      contractId: slot?.contractId || null,
      contractCodeSnapshot: slot?.contract?.contractNumber || slot?.contractId || "Contract",
      projectId: slot?.site?.projectId || null,
      projectNameSnapshot: slot?.site?.project?.name || "Project",
      siteId: slot?.siteId || null,
      siteNameSnapshot: slot?.site?.name || "Site",
      shiftRequirementId: slot?.shiftRequirementId || null,
      requirementSeriesId: slot?.requirementSeriesId || null,
      requirementSlotId: slot?.id || null,
      locationUnitId: slot?.locationUnitId || null,
      postId: slot?.postId || null,
      zoneId: slot?.zoneId || null,
      requiredPositionCategoryId: slot?.requiredPositionCategoryId || null,
      positionCategory: slot?.snapshotPosition || "Guard/Staff",
      slotIndex: slot?.slotIndex || 1,
      publicationId: slot?.publicationId || null,
      assignmentId: firstAssignmentId,
      attendanceId: firstAttendanceId,
      reconciliationId: null,
      plannedManpower,
      plannedPostMinutes,
      assignedManpower,
      verifiedPresentManpower,
      verifiedAttendedMinutes,
      coveredPostMinutes,
      shortageCount,
      unapprovedExtraCount,
      approvedExtraCount,
      relieverSubstitutionCount,
      focRelieverMinutes,
      baseBillableAdvisoryQty,
      additionalRelieverAdvisoryQty,
      billableAdvisoryQuantity,
      billingBasis: bBasis,
      warningCodes: warnings,
      notes: shortageCount > 0 ? "Under-deployment detected" : "Full post covered",
      contractEvidenceJson: {
        contractId: slot?.contractId || null,
        contractCode: slot?.contract?.contractNumber || null,
        siteId: slot?.siteId || null,
        requirementSeriesId: slot?.requirementSeriesId || null,
        publicationId: slot?.publicationId || null,
        assignmentsCount: asgs.length
      }
    });
  });

  return {
    lines,
    summary: {
      totalPlannedManpower,
      totalAssignedManpower,
      totalVerifiedPresent,
      totalBillableQuantity,
      lineCount: lines.length
    },
    sourceVersionJson
  };
}

/**
 * Creates a durable ManpowerBillingSupportRun with scoped idempotency.
 */
export async function createDurableBillingRun(params: BillingSupportCalculationParams): Promise<any> {
  const runScopeKey = calculateRunScopeKey(params.companyId);
  validateScopeKeyConsistency(runScopeKey, params.companyId);

  if (params.idempotencyKey) {
    const existingKeyRun = await prisma.manpowerBillingSupportRun.findFirst({
      where: {
        runScopeKey,
        operationType: params.operationType,
        idempotencyKey: params.idempotencyKey
      },
      include: { lines: true }
    });
    if (existingKeyRun) {
      if (params.requestHash && existingKeyRun.requestHash !== params.requestHash) {
        const err: any = new Error("IDEMPOTENCY_KEY_REUSED: Idempotency key reused with different request payload");
        err.statusCode = 409;
        throw err;
      }
      return existingKeyRun;
    }
  }

  const year = parseInt(params.period.split("-")[0]);
  const month = parseInt(params.period.split("-")[1]);
  const fromDate = new Date(year, month - 1, 1);
  const toDate = new Date(year, month, 0);
  const runCode = `BILL-${params.operationType}-${params.period}-${Date.now().toString(36)}`;

  const existingRun = await prisma.manpowerBillingSupportRun.findFirst({
    where: {
      operationType: params.operationType as any,
      period: params.period,
      status: { in: ["LOCKED", "EXPORTED"] as any }
    },
    orderBy: { version: "desc" }
  });

  const nextVersion = existingRun ? existingRun.version + 1 : 1;

  if (existingRun) {
    await prisma.manpowerBillingSupportRun.update({
      where: { id: existingRun.id },
      data: { status: "SUPERSEDED" as any, supersededAt: new Date() }
    });
  }

  const { lines, summary, sourceVersionJson } = await calculateBillingSupportData(params);

  const primaryProfile = sourceVersionJson.workCalendarProfiles?.[0];

  const run = await prisma.manpowerBillingSupportRun.create({
    data: {
      runCode,
      runScopeKey,
      idempotencyKey: params.idempotencyKey || null,
      requestHash: params.requestHash || null,
      correlationId: params.correlationId || null,
      operationType: params.operationType as any,
      period: params.period,
      companyId: params.companyId || null,
      fromDate,
      toDate,
      status: "CALCULATED" as any,
      version: nextVersion,
      calculationVersion: 3,
      workCalendarProfileId: primaryProfile?.id || null,
      ramadanPeriodId: sourceVersionJson.ramadanPeriod?.id || null,
      holidayCalendarId: sourceVersionJson.holidayCalendar?.id || null,
      sourceVersionJson,
      supersedesRunId: existingRun?.id || null,
      calculatedBy: params.calculatedBy,
      resultSummary: summary,
      lines: {
        create: lines.map(line => ({
          businessDate: new Date(line.businessDate),
          clientId: line.clientId,
          clientNameSnapshot: line.clientNameSnapshot,
          contractId: line.contractId,
          contractCodeSnapshot: line.contractCodeSnapshot,
          projectId: line.projectId,
          projectNameSnapshot: line.projectNameSnapshot,
          siteId: line.siteId,
          siteNameSnapshot: line.siteNameSnapshot,
          shiftRequirementId: line.shiftRequirementId,
          requirementSeriesId: line.requirementSeriesId,
          requirementSlotId: line.requirementSlotId,
          locationUnitId: line.locationUnitId,
          postId: line.postId,
          zoneId: line.zoneId,
          requiredPositionCategoryId: line.requiredPositionCategoryId,
          positionCategory: line.positionCategory,
          slotIndex: line.slotIndex,
          publicationId: line.publicationId,
          assignmentId: line.assignmentId,
          attendanceId: line.attendanceId,
          reconciliationId: line.reconciliationId,
          plannedManpower: line.plannedManpower,
          plannedPostMinutes: line.plannedPostMinutes,
          assignedManpower: line.assignedManpower,
          verifiedPresentManpower: line.verifiedPresentManpower,
          verifiedAttendedMinutes: line.verifiedAttendedMinutes,
          coveredPostMinutes: line.coveredPostMinutes,
          shortageCount: line.shortageCount,
          unapprovedExtraCount: line.unapprovedExtraCount,
          approvedExtraCount: line.approvedExtraCount,
          relieverSubstitutionCount: line.relieverSubstitutionCount,
          focRelieverMinutes: line.focRelieverMinutes,
          baseBillableAdvisoryQty: line.baseBillableAdvisoryQty,
          additionalRelieverAdvisoryQty: line.additionalRelieverAdvisoryQty,
          billableAdvisoryQuantity: line.billableAdvisoryQuantity,
          billingBasis: line.billingBasis as any,
          contractEvidenceJson: line.contractEvidenceJson,
          warningCodes: line.warningCodes,
          notes: line.notes
        }))
      }
    },
    include: { lines: true }
  });

  return run;
}
