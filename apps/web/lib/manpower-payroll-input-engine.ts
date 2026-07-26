import { prisma } from "@ahh-wfm/database";
import { resolveEmployeeCalendarContext } from "./manpower-work-calendar-engine";

export interface PayrollInputCalculationParams {
  operationType: string; // "SECURITY_GUARDING" | "FACILITY_MANAGEMENT"
  period: string;        // "YYYY-MM"
  siteId?: string;
  employeeId?: string;
  companyId?: string;
  calculatedBy: string;
}

export interface CalculatedPayrollLine {
  employeeId: string;
  employeeCodeSnapshot: string;
  employeeNameSnapshot: string;
  siteId: string | null;
  siteNameSnapshot: string;
  regularWorkedDays: number;
  regularVerifiedMinutes: number;
  ramadanWorkedMinutes: number;
  ramadanExcessCandidateMinutes: number;
  overtimeCandidateMinutes: number;
  publicHolidayWorkedDays: number;
  publicHolidayWorkedMinutes: number;
  weeklyRestWorkedDays: number;
  weeklyRestWorkedMinutes: number;
  actingDutyCandidateDays: number;
  actingDutyCandidateMinutes: number;
  siteAllowanceCandidateDays: number;
  leaveDays: number;
  absenceDays: number;
  reconciliationStatus: string;
  readinessStatus: string;
  advisoryClassifications: string[];
  advisoryWarnings: string[];
  evidenceReferences: any;
}

/**
 * Calculates MP-4 Operational Payroll Input Advisory data for employees.
 * NO MONETARY PAYROLL AMOUNTS OR SALARY CALCULATIONS.
 */
export async function calculatePayrollInputData(
  params: PayrollInputCalculationParams
): Promise<{ lines: CalculatedPayrollLine[]; overallReadiness: string; summary: any; sourceVersionJson: any }> {
  const year = parseInt(params.period.split("-")[0]);
  const month = parseInt(params.period.split("-")[1]);
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  // Fetch active profiles and calendar versions for source tracking
  const activeProfile = await prisma.manpowerWorkCalendarProfile.findFirst({
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
    workCalendarProfileId: activeProfile?.id || null,
    workCalendarProfileVersion: activeProfile?.version || 1,
    ramadanPeriodId: activeRamadan?.id || null,
    ramadanPeriodVersion: activeRamadan?.version || 1,
    holidayCalendarId: activeHolidayCal?.id || null,
    holidayCalendarVersion: activeHolidayCal?.version || 1,
    calculationEngineVersion: 2,
    calculatedAt: new Date().toISOString()
  };

  // 1. Fetch Target Employees
  const employees = await prisma.employee.findMany({
    where: {
      operationType: params.operationType,
      isActive: true,
      ...(params.companyId ? { companyId: params.companyId } : {}),
      ...(params.employeeId ? { id: params.employeeId } : {})
    },
    include: { company: true }
  });

  // 2. Fetch Assignments
  const assignments = await prisma.rosterSlotAssignment.findMany({
    where: {
      employee: { operationType: params.operationType, ...(params.companyId ? { companyId: params.companyId } : {}) },
      slot: { businessDate: { gte: start, lte: end } }
    },
    include: {
      slot: { include: { site: true } },
      employee: true
    }
  });

  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: {
      checkIn: { gte: start, lte: end },
      employee: { operationType: params.operationType, ...(params.companyId ? { companyId: params.companyId } : {}) }
    }
  });

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      employee: { operationType: params.operationType, ...(params.companyId ? { companyId: params.companyId } : {}) },
      status: "APPROVED",
      startDate: { lte: end },
      endDate: { gte: start }
    }
  });

  const reconciliations = await prisma.attendanceRosterReconciliation.findMany({
    where: {
      operationType: params.operationType,
      businessDate: { gte: start, lte: end }
    }
  });

  const siteAllowances = await prisma.securitySiteAllowance.findMany({
    where: { siteAllowanceEnabled: true }
  });

  const lines: CalculatedPayrollLine[] = [];
  let globalHasUnconfiguredRule = false;
  let globalHasUnresolvedRecon = false;

  for (const emp of employees) {
    const workerCategory =
      emp.operationType === "SECURITY_GUARDING" ? "SECURITY_GUARDING" : "CLEANING";

    let regularWorkedDays = 0;
    let regularVerifiedMinutes = 0;
    let ramadanWorkedMinutes = 0;
    let ramadanExcessCandidateMinutes = 0;
    let overtimeCandidateMinutes = 0;
    let publicHolidayWorkedDays = 0;
    let publicHolidayWorkedMinutes = 0;
    let weeklyRestWorkedDays = 0;
    let weeklyRestWorkedMinutes = 0;
    let actingDutyCandidateDays = 0;
    let actingDutyCandidateMinutes = 0;
    let siteAllowanceCandidateDays = 0;
    let leaveDays = 0;
    let absenceDays = 0;

    const advisoryClassifications: string[] = [];
    const advisoryWarnings: string[] = [];
    const evidenceList: any[] = [];
    let primarySiteName = emp.defaultSiteId || "Default Site";

    const empAsgs = assignments.filter(a => a.employeeId === emp.id);
    const empAtts = attendanceRecords.filter(a => a.employeeId === emp.id);
    const empLeaves = leaves.filter(l => l.employeeId === emp.id);
    const empRecons = reconciliations.filter(r => r.expectedEmployeeId === emp.id);

    let hasUnconfiguredRule = false;
    let hasUnresolvedRecon = false;

    // Process daily assignments and attendance
    const dayMap = new Map<string, { asg?: any; att?: any }>();
    empAsgs.forEach(a => {
      const dStr = a.slot.businessDate.toISOString().split("T")[0];
      if (!dayMap.has(dStr)) dayMap.set(dStr, {});
      dayMap.get(dStr)!.asg = a;
      if (a.slot.site?.name) primarySiteName = a.slot.site.name;
    });
    empAtts.forEach(att => {
      const dStr = att.checkIn.toISOString().split("T")[0];
      if (!dayMap.has(dStr)) dayMap.set(dStr, {});
      dayMap.get(dStr)!.att = att;
    });

    for (const [dStr, { asg, att }] of dayMap.entries()) {
      const dObj = new Date(dStr);
      const ctx = await resolveEmployeeCalendarContext({
        employeeId: emp.id,
        workerCategory,
        operationType: emp.operationType,
        companyId: emp.companyId,
        date: dObj
      });

      if (!ctx.profile) {
        hasUnconfiguredRule = true;
        globalHasUnconfiguredRule = true;
        advisoryWarnings.push("RAMADAN_RULE_NOT_CONFIGURED");
      }

      let minsWorked = 0;
      if (att && att.checkIn && att.checkOut) {
        minsWorked = Math.round((att.checkOut.getTime() - att.checkIn.getTime()) / (1000 * 60));
      } else if (asg && att) {
        minsWorked = 480;
      }

      if (minsWorked > 0) {
        regularWorkedDays++;
        regularVerifiedMinutes += minsWorked;

        evidenceList.push({
          date: dStr,
          assignmentId: asg?.id || null,
          attendanceId: att?.id || null,
          minsWorked,
          isRamadan: ctx.isRamadanActive,
          isHoliday: ctx.isPublicHoliday,
          isRestDay: ctx.isWeeklyRestDay
        });

        if (ctx.isRamadanActive) {
          ramadanWorkedMinutes += minsWorked;
          const thresh = ctx.dailyThresholdMinutes || 360;
          if (minsWorked > thresh) {
            ramadanExcessCandidateMinutes += (minsWorked - thresh);
          }
        } else if (ctx.dailyThresholdMinutes && minsWorked > ctx.dailyThresholdMinutes) {
          overtimeCandidateMinutes += (minsWorked - ctx.dailyThresholdMinutes);
        }

        if (ctx.isPublicHoliday) {
          publicHolidayWorkedDays++;
          publicHolidayWorkedMinutes += minsWorked;
        }

        if (ctx.isWeeklyRestDay) {
          weeklyRestWorkedDays++;
          weeklyRestWorkedMinutes += minsWorked;
        }

        if (asg && asg.slot?.snapshotPosition && (emp as any).positionCategory?.categoryName && asg.slot.snapshotPosition !== (emp as any).positionCategory.categoryName) {
          actingDutyCandidateDays++;
          actingDutyCandidateMinutes += minsWorked;
        }

        const siteAllow = siteAllowances.find(s => s.siteId === asg?.slot?.siteId);
        if (siteAllow) {
          siteAllowanceCandidateDays++;
        }
      } else if (asg && !att) {
        // Unapproved absence
        absenceDays++;
      }
    }

    // Process Leaves safely
    empLeaves.forEach(l => {
      const lStart = l.startDate ? (l.startDate < start ? start : l.startDate) : start;
      const lEnd = l.endDate ? (l.endDate > end ? end : l.endDate) : end;
      const days = Math.max(1, Math.round((lEnd.getTime() - lStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      leaveDays += days;
    });

    let reconStatus = "MATCHED";
    empRecons.forEach(r => {
      if (r.detectionOutcome !== "ON_TIME" && r.resolution !== "EXCUSED") {
        hasUnresolvedRecon = true;
        globalHasUnresolvedRecon = true;
        reconStatus = r.detectionOutcome || "UNRESOLVED";
      }
    });

    let readinessStatus = "READY_FOR_PAYROLL_REVIEW";
    if (hasUnconfiguredRule) {
      readinessStatus = "RAMADAN_RULE_NOT_CONFIGURED";
    } else if (hasUnresolvedRecon) {
      readinessStatus = "NEEDS_ATTENDANCE_RECONCILIATION";
    } else if (overtimeCandidateMinutes > 0) {
      readinessStatus = "NEEDS_OVERTIME_APPROVAL";
    }

    if (ramadanWorkedMinutes > 0) advisoryClassifications.push("RAMADAN_WORK");
    if (publicHolidayWorkedDays > 0) advisoryClassifications.push("PUBLIC_HOLIDAY_WORKED");
    if (weeklyRestWorkedDays > 0) advisoryClassifications.push("WEEKLY_REST_WORKED");
    if (actingDutyCandidateDays > 0) advisoryClassifications.push("ACTING_DUTY_CANDIDATE");
    if (siteAllowanceCandidateDays > 0) advisoryClassifications.push("SITE_ALLOWANCE_CANDIDATE");

    lines.push({
      employeeId: emp.id,
      employeeCodeSnapshot: emp.id,
      employeeNameSnapshot: emp.name,
      siteId: emp.defaultSiteId || null,
      siteNameSnapshot: primarySiteName,
      regularWorkedDays,
      regularVerifiedMinutes,
      ramadanWorkedMinutes,
      ramadanExcessCandidateMinutes,
      overtimeCandidateMinutes,
      publicHolidayWorkedDays,
      publicHolidayWorkedMinutes,
      weeklyRestWorkedDays,
      weeklyRestWorkedMinutes,
      actingDutyCandidateDays,
      actingDutyCandidateMinutes,
      siteAllowanceCandidateDays,
      leaveDays,
      absenceDays,
      reconciliationStatus: reconStatus,
      readinessStatus,
      advisoryClassifications,
      advisoryWarnings,
      evidenceReferences: evidenceList
    });
  }

  let overallReadiness = "READY_FOR_PAYROLL_REVIEW";
  if (globalHasUnconfiguredRule) {
    overallReadiness = "RAMADAN_RULE_NOT_CONFIGURED";
  } else if (globalHasUnresolvedRecon) {
    overallReadiness = "NEEDS_ATTENDANCE_RECONCILIATION";
  }

  return {
    lines,
    overallReadiness,
    summary: {
      employeeCount: lines.length,
      totalRegularDays: lines.reduce((acc, l) => acc + l.regularWorkedDays, 0),
      totalOvertimeCandidateMinutes: lines.reduce((acc, l) => acc + l.overtimeCandidateMinutes, 0),
      totalRamadanExcessCandidateMinutes: lines.reduce((acc, l) => acc + l.ramadanExcessCandidateMinutes, 0)
    },
    sourceVersionJson
  };
}

export interface PayrollInputCalculationParams {
  operationType: string; // "SECURITY_GUARDING" | "FACILITY_MANAGEMENT"
  period: string;        // "YYYY-MM"
  siteId?: string;
  employeeId?: string;
  companyId?: string;
  calculatedBy: string;
  idempotencyKey?: string;
  requestHash?: string;
  correlationId?: string;
}

/**
 * Creates a durable ManpowerPayrollAdvisoryRun and saves its lines and employee-day detail records.
 * Retains immutability for LOCKED or EXPORTED runs by creating a new version.
 */
export async function createDurablePayrollRun(params: PayrollInputCalculationParams): Promise<any> {
  if (params.idempotencyKey) {
    const existingKeyRun = await prisma.manpowerPayrollAdvisoryRun.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
      include: { lines: { include: { days: true } } }
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
  const runCode = `PAY-${params.operationType}-${params.period}-${Date.now().toString(36)}`;

  const existingRun = await prisma.manpowerPayrollAdvisoryRun.findFirst({
    where: {
      operationType: params.operationType,
      period: params.period,
      status: { in: ["LOCKED", "EXPORTED"] }
    },
    orderBy: { version: "desc" }
  });

  const nextVersion = existingRun ? existingRun.version + 1 : 1;

  if (existingRun) {
    await prisma.manpowerPayrollAdvisoryRun.update({
      where: { id: existingRun.id },
      data: { status: "SUPERSEDED", supersededAt: new Date() }
    });
  }

  const { lines, overallReadiness, summary, sourceVersionJson } = await calculatePayrollInputData(params);

  const run = await prisma.manpowerPayrollAdvisoryRun.create({
    data: {
      runCode,
      idempotencyKey: params.idempotencyKey || null,
      requestHash: params.requestHash || null,
      correlationId: params.correlationId || null,
      operationType: params.operationType,
      period: params.period,
      companyId: params.companyId || null,
      fromDate,
      toDate,
      status: "CALCULATED",
      readiness: overallReadiness as any,
      version: nextVersion,
      calculationVersion: 2,
      workCalendarProfileId: sourceVersionJson.workCalendarProfileId,
      ramadanPeriodId: sourceVersionJson.ramadanPeriodId,
      holidayCalendarId: sourceVersionJson.holidayCalendarId,
      sourceVersionJson,
      supersedesRunId: existingRun?.id || null,
      workCalendarProfileVersion: sourceVersionJson.workCalendarProfileVersion,
      holidayCalendarVersion: sourceVersionJson.holidayCalendarVersion,
      calculatedBy: params.calculatedBy,
      resultSummary: summary,
      lines: {
        create: lines.map(line => ({
          employeeId: line.employeeId,
          employeeCodeSnapshot: line.employeeCodeSnapshot,
          employeeNameSnapshot: line.employeeNameSnapshot,
          siteId: line.siteId,
          siteNameSnapshot: line.siteNameSnapshot,
          regularWorkedDays: line.regularWorkedDays,
          regularVerifiedMinutes: line.regularVerifiedMinutes,
          ramadanWorkedMinutes: line.ramadanWorkedMinutes,
          ramadanExcessCandidateMinutes: line.ramadanExcessCandidateMinutes,
          overtimeCandidateMinutes: line.overtimeCandidateMinutes,
          publicHolidayWorkedDays: line.publicHolidayWorkedDays,
          publicHolidayWorkedMinutes: line.publicHolidayWorkedMinutes,
          weeklyRestWorkedDays: line.weeklyRestWorkedDays,
          weeklyRestWorkedMinutes: line.weeklyRestWorkedMinutes,
          actingDutyCandidateDays: line.actingDutyCandidateDays,
          actingDutyCandidateMinutes: line.actingDutyCandidateMinutes,
          siteAllowanceCandidateDays: line.siteAllowanceCandidateDays,
          leaveDays: line.leaveDays,
          absenceDays: line.absenceDays,
          reconciliationStatus: line.reconciliationStatus,
          readinessStatus: line.readinessStatus as any,
          advisoryClassifications: line.advisoryClassifications,
          advisoryWarnings: line.advisoryWarnings,
          evidenceReferences: line.evidenceReferences,
          days: {
            create: (Array.isArray(line.evidenceReferences) ? line.evidenceReferences : []).map((ev: any) => ({
              businessDate: new Date(ev.date),
              assignmentId: ev.assignmentId || null,
              requirementSlotId: ev.requirementSlotId || null,
              siteId: ev.siteId || line.siteId,
              regularMinutes: ev.minsWorked || 0,
              ramadanMinutes: ev.isRamadan ? (ev.minsWorked || 0) : 0,
              overtimeCandidateMinutes: ev.overtimeMins || 0,
              publicHolidayMinutes: ev.isHoliday ? (ev.minsWorked || 0) : 0,
              weeklyRestMinutes: ev.isRestDay ? (ev.minsWorked || 0) : 0,
              actingDutyCandidateMinutes: ev.actingDutyMins || 0,
              siteAllowanceCandidate: !!ev.siteAllowance,
              leaveClassification: ev.leaveClass || null,
              absenceClassification: ev.absenceClass || null,
              attendanceEvidenceJson: ev.attendanceId ? { attendanceId: ev.attendanceId } : undefined,
              reconciliationEvidenceJson: ev.reconciliationId ? { reconciliationId: ev.reconciliationId } : undefined,
              warningCodes: ev.warnings || []
            }))
          }
        }))
      }
    },
    include: { lines: { include: { days: true } } }
  });

  return run;
}

