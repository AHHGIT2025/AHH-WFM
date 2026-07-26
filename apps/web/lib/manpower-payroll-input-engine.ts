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
): Promise<{ lines: CalculatedPayrollLine[]; overallReadiness: string; summary: any }> {
  const year = parseInt(params.period.split("-")[0]);
  const month = parseInt(params.period.split("-")[1]);
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  // 1. Fetch Target Employees
  const employees = await prisma.employee.findMany({
    where: {
      operationType: params.operationType,
      isActive: true,
      ...(params.employeeId ? { id: params.employeeId } : {})
    },
    include: { company: true }
  });

  // 2. Fetch Assignments
  const assignments = await prisma.rosterSlotAssignment.findMany({
    where: {
      employee: { operationType: params.operationType },
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
      employee: { operationType: params.operationType }
    }
  });

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      employee: { operationType: params.operationType },
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
    let empSiteId: string | null = null;
    let empSiteName = "Default Location";

    const empClassifications = new Set<string>();
    const empWarnings: string[] = [];
    const evidenceRefs: any = { dates: [] };

    const totalDaysInMonth = new Date(year, month, 0).getDate();
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const d = new Date(year, month - 1, day);
      const dStr = d.toISOString().split("T")[0];

      const calCtx = await resolveEmployeeCalendarContext({
        employeeId: emp.id,
        workerCategory,
        operationType: params.operationType,
        companyId: emp.companyId,
        date: d,
        employeeWeeklyRestDay: "FRIDAY"
      });

      if (!calCtx.profile) {
        globalHasUnconfiguredRule = true;
        empWarnings.push("RAMADAN_RULE_NOT_CONFIGURED");
      }

      // Check Leave
      const onLeave = leaves.some((l: any) => {
        const lStart = l.startDate ? new Date(l.startDate) : null;
        const lEnd = l.endDate ? new Date(l.endDate) : null;
        return lStart && lEnd && lStart <= d && lEnd >= d && l.employeeId === emp.id;
      });

      if (onLeave) {
        leaveDays++;
        empClassifications.add("APPROVED_LEAVE");
        continue;
      }

      // Find Slot Assignment
      const asg = assignments.find(
        a => a.employeeId === emp.id && a.slot.businessDate.toISOString().split("T")[0] === dStr
      );

      if (asg && asg.slot?.siteId) {
        empSiteId = asg.slot.siteId;
        empSiteName = asg.slot.site?.name || "Site";
      }

      const att = attendanceRecords.find(
        a => a.employeeId === emp.id && a.checkIn.toISOString().split("T")[0] === dStr
      );

      const actualMinutes = att && att.checkIn && att.checkOut
        ? Math.round((att.checkOut.getTime() - att.checkIn.getTime()) / (1000 * 60))
        : att ? 480 : 0;

      if (calCtx.isPublicHoliday && asg) {
        publicHolidayWorkedDays++;
        publicHolidayWorkedMinutes += actualMinutes;
        empClassifications.add("PUBLIC_HOLIDAY_WORKED");
      }

      if (calCtx.isWeeklyRestDay && actualMinutes > 0) {
        weeklyRestWorkedDays++;
        weeklyRestWorkedMinutes += actualMinutes;
        empClassifications.add("WEEKLY_REST_WORKED");
      }

      if (actualMinutes > 0 && !calCtx.isPublicHoliday && !calCtx.isWeeklyRestDay) {
        regularWorkedDays++;
        if (calCtx.isRamadanActive) {
          ramadanWorkedMinutes += Math.min(actualMinutes, calCtx.dailyThresholdMinutes || 360);
          if (calCtx.dailyThresholdMinutes && actualMinutes > calCtx.dailyThresholdMinutes) {
            ramadanExcessCandidateMinutes += actualMinutes - calCtx.dailyThresholdMinutes;
            empClassifications.add("RAMADAN_EXCESS_HOURS_CANDIDATE");
          }
          empClassifications.add("RAMADAN_REGULAR_WORK");
        } else {
          regularVerifiedMinutes += Math.min(actualMinutes, calCtx.dailyThresholdMinutes || 480);
          if (calCtx.dailyThresholdMinutes && actualMinutes > calCtx.dailyThresholdMinutes) {
            overtimeCandidateMinutes += actualMinutes - calCtx.dailyThresholdMinutes;
            empClassifications.add("OVERTIME_CANDIDATE");
          }
          empClassifications.add("REGULAR_WORK");
        }
      }

      if (asg && !att && !onLeave) {
        absenceDays++;
        empClassifications.add("UNAPPROVED_ABSENCE");
      }

      if (asg && asg.slot) {
        const empTrade = emp.positionCategoryId || emp.designationId;
        const reqTrade = asg.slot.snapshotPosition;
        if (empTrade && reqTrade && empTrade !== reqTrade) {
          actingDutyCandidateDays++;
          actingDutyCandidateMinutes += actualMinutes || 480;
          empClassifications.add("ACTING_DUTY_CANDIDATE");
        }
      }

      if (empSiteId) {
        const hasSiteAllowance = siteAllowances.some(
          (sa: any) => sa.siteId === empSiteId && sa.siteAllowanceEnabled === true
        );
        if (hasSiteAllowance && actualMinutes > 0) {
          siteAllowanceCandidateDays++;
          empClassifications.add("SITE_ALLOWANCE_CANDIDATE");
        }
      }
    }

    const empRecons = reconciliations.filter(r => r.expectedEmployeeId === emp.id);
    const hasPendingRecon = empRecons.some(r => r.workflowStatus === "OPEN");
    if (hasPendingRecon) globalHasUnresolvedRecon = true;

    let readinessStatus = "READY_FOR_PAYROLL_REVIEW";
    if (empWarnings.includes("RAMADAN_RULE_NOT_CONFIGURED")) {
      readinessStatus = "RAMADAN_RULE_NOT_CONFIGURED";
    } else if (hasPendingRecon) {
      readinessStatus = "NEEDS_ATTENDANCE_RECONCILIATION";
    } else if (overtimeCandidateMinutes > 0) {
      readinessStatus = "NEEDS_OVERTIME_APPROVAL";
    } else if (actingDutyCandidateDays > 0) {
      readinessStatus = "NEEDS_ACTING_DUTY_APPROVAL";
    }

    lines.push({
      employeeId: emp.id,
      employeeCodeSnapshot: emp.id,
      employeeNameSnapshot: emp.name,
      siteId: empSiteId,
      siteNameSnapshot: empSiteName,
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
      reconciliationStatus: hasPendingRecon ? "NEEDS_RECONCILIATION" : "MATCHED",
      readinessStatus,
      advisoryClassifications: Array.from(empClassifications),
      advisoryWarnings: empWarnings,
      evidenceReferences: evidenceRefs
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
      totalEmployees: lines.length,
      readyCount: lines.filter(l => l.readinessStatus === "READY_FOR_PAYROLL_REVIEW").length,
      needsReviewCount: lines.filter(l => l.readinessStatus !== "READY_FOR_PAYROLL_REVIEW").length
    }
  };
}

/**
 * Creates a durable ManpowerPayrollAdvisoryRun and saves its lines.
 * Retains immutability for LOCKED or EXPORTED runs by creating a new version.
 */
export async function createDurablePayrollRun(params: PayrollInputCalculationParams): Promise<any> {
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

  const { lines, overallReadiness, summary } = await calculatePayrollInputData(params);

  const run = await prisma.manpowerPayrollAdvisoryRun.create({
    data: {
      runCode,
      operationType: params.operationType,
      period: params.period,
      status: "CALCULATED",
      readiness: overallReadiness as any,
      version: nextVersion,
      supersedesRunId: existingRun?.id || null,
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
          evidenceReferences: line.evidenceReferences
        }))
      }
    },
    include: { lines: true }
  });

  return run;
}
