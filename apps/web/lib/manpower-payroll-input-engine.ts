import { prisma } from "@ahh-wfm/database";
import { calculateRunScopeKey, validateScopeKeyConsistency } from "./manpower-billing-support-engine";

export interface PayrollInputCalculationParams {
  operationType: "SECURITY_GUARDING" | "FACILITY_MANAGEMENT";
  period: string;        // "YYYY-MM"
  siteId?: string;
  employeeId?: string;
  companyId?: string;
  calculatedBy: string;
  idempotencyKey?: string;
  requestHash?: string;
  correlationId?: string;
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
  reconciliationStatus: "MATCHED" | "UNMATCHED" | "PENDING_RECONCILIATION";
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

  // Fetch all active profiles across worker categories (SG, Cleaning, White Collar) for multi-profile source tracking
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
      employeeId: { in: employees.map(e => e.id) },
      slot: {
        businessDate: { gte: start, lte: end }
      }
    },
    include: {
      slot: { include: { site: true, contract: true } }
    }
  });

  // 3. Fetch Verified Attendance
  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: {
      employeeId: { in: employees.map(e => e.id) },
      checkIn: { gte: start, lte: end }
    }
  });

  // 4. Fetch Holidays
  const holidays = activeHolidayCal
    ? await prisma.manpowerHolidayDate.findMany({
        where: { calendarId: activeHolidayCal.id }
      })
    : [];

  const lines: CalculatedPayrollLine[] = [];
  let globalHasUnconfiguredRule = false;
  let globalHasUnresolvedRecon = false;

  for (const emp of employees) {
    const empAsgs = assignments.filter(a => a.employeeId === emp.id);
    const empAtts = attendanceRecords.filter(a => a.employeeId === emp.id);

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

    const profileForEmp = activeProfiles.find(p => p.workerCategory === emp.employeeCategory) || activeProfiles[0];

    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const dDate = new Date(year, month - 1, day);
      const dStr = dDate.toISOString().split("T")[0];

      const dayAsgs = empAsgs.filter(a => a.slot.businessDate.toISOString().split("T")[0] === dStr);
      const dayAtts = empAtts.filter(a => a.checkIn.toISOString().split("T")[0] === dStr);

      const isHoliday = holidays.some(h => h.holidayDate.toISOString().split("T")[0] === dStr);
      const isRamadanDate = activeRamadan && dDate >= activeRamadan.startDate && dDate <= activeRamadan.endDate;

      if (dayAsgs.length > 0 || dayAtts.length > 0) {
        let minsWorked = 0;
        dayAtts.forEach(att => {
          if (att.checkIn && att.checkOut) {
            minsWorked += Math.round((att.checkOut.getTime() - att.checkIn.getTime()) / (1000 * 60));
          } else {
            minsWorked += 480;
          }
        });

        if (minsWorked === 0 && dayAsgs.length > 0) {
          minsWorked = 480;
        }

        const dailyThreshold = isRamadanDate
          ? (profileForEmp?.ramadanDailyMinutes || 360)
          : (profileForEmp?.ordinaryDailyMinutes || 480);

        regularWorkedDays++;
        regularVerifiedMinutes += Math.min(minsWorked, dailyThreshold);

        if (minsWorked > dailyThreshold) {
          const excess = minsWorked - dailyThreshold;
          if (isRamadanDate) {
            ramadanExcessCandidateMinutes += excess;
          } else {
            overtimeCandidateMinutes += excess;
          }
        }

        if (isRamadanDate) {
          ramadanWorkedMinutes += Math.min(minsWorked, dailyThreshold);
        }

        if (isHoliday) {
          publicHolidayWorkedDays++;
          publicHolidayWorkedMinutes += minsWorked;
          advisoryClassifications.push(`PUBLIC_HOLIDAY_WORKED:${dStr}`);
        }

        dayAsgs.forEach((asg, idx) => {
          evidenceList.push({
            date: dStr,
            evidenceGroupKey: `ASSIGNMENT:${asg.id}`,
            assignmentId: asg.id,
            requirementSlotId: asg.slotId,
            siteId: asg.slot.siteId,
            minsWorked,
            isRamadan: !!isRamadanDate,
            isHoliday,
            isRestDay: false,
            overtimeMins: minsWorked > dailyThreshold ? minsWorked - dailyThreshold : 0,
            attendanceId: dayAtts[0]?.id || null
          });
        });

        if (dayAsgs.length === 0 && dayAtts.length > 0) {
          evidenceList.push({
            date: dStr,
            evidenceGroupKey: `ATTENDANCE:${dayAtts[0].id}`,
            assignmentId: null,
            requirementSlotId: null,
            siteId: emp.companyId || null,
            minsWorked,
            isRamadan: !!isRamadanDate,
            isHoliday,
            isRestDay: false,
            overtimeMins: minsWorked > dailyThreshold ? minsWorked - dailyThreshold : 0,
            attendanceId: dayAtts[0].id
          });
        }
      }
    }

    if (!profileForEmp) {
      advisoryWarnings.push("RAMADAN_RULE_NOT_CONFIGURED");
      globalHasUnconfiguredRule = true;
    }

    const reconStatus: "MATCHED" | "UNMATCHED" | "PENDING_RECONCILIATION" =
      empAsgs.length === empAtts.length ? "MATCHED" : "UNMATCHED";

    if (reconStatus === "UNMATCHED") {
      globalHasUnresolvedRecon = true;
    }

    const readinessStatus = !profileForEmp
      ? "RAMADAN_RULE_NOT_CONFIGURED"
      : reconStatus === "UNMATCHED"
      ? "NEEDS_ATTENDANCE_RECONCILIATION"
      : "READY_FOR_PAYROLL_REVIEW";

    lines.push({
      employeeId: emp.id,
      employeeCodeSnapshot: emp.id,
      employeeNameSnapshot: emp.name || emp.id,
      siteId: empAsgs[0]?.slot?.siteId || null,
      siteNameSnapshot: empAsgs[0]?.slot?.site?.name || "Primary Site",
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

/**
 * Creates a durable ManpowerPayrollAdvisoryRun with scoped idempotency and evidenceGroupKey.
 */
export async function createDurablePayrollRun(params: PayrollInputCalculationParams): Promise<any> {
  const runScopeKey = calculateRunScopeKey(params.companyId);
  validateScopeKeyConsistency(runScopeKey, params.companyId);

  if (params.idempotencyKey) {
    const existingKeyRun = await prisma.manpowerPayrollAdvisoryRun.findFirst({
      where: {
        runScopeKey,
        operationType: params.operationType,
        idempotencyKey: params.idempotencyKey
      },
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
      operationType: params.operationType as any,
      period: params.period,
      status: { in: ["LOCKED", "EXPORTED"] as any }
    },
    orderBy: { version: "desc" }
  });

  const nextVersion = existingRun ? existingRun.version + 1 : 1;

  if (existingRun) {
    await prisma.manpowerPayrollAdvisoryRun.update({
      where: { id: existingRun.id },
      data: { status: "SUPERSEDED" as any, supersededAt: new Date() }
    });
  }

  const { lines, overallReadiness, summary, sourceVersionJson } = await calculatePayrollInputData(params);

  const primaryProfile = sourceVersionJson.workCalendarProfiles?.[0];

  const run = await prisma.manpowerPayrollAdvisoryRun.create({
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
      readiness: overallReadiness as any,
      version: nextVersion,
      calculationVersion: 3,
      workCalendarProfileId: primaryProfile?.id || null,
      ramadanPeriodId: sourceVersionJson.ramadanPeriod?.id || null,
      holidayCalendarId: sourceVersionJson.holidayCalendar?.id || null,
      sourceVersionJson,
      supersedesRunId: existingRun?.id || null,
      workCalendarProfileVersion: primaryProfile?.version || 1,
      holidayCalendarVersion: sourceVersionJson.holidayCalendar?.version || 1,
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
          reconciliationStatus: line.reconciliationStatus as any,
          readinessStatus: line.readinessStatus as any,
          advisoryClassifications: line.advisoryClassifications,
          advisoryWarnings: line.advisoryWarnings,
          evidenceReferences: line.evidenceReferences,
          days: {
            create: (Array.isArray(line.evidenceReferences) ? line.evidenceReferences : []).map((ev: any, idx: number) => ({
              businessDate: new Date(ev.date),
              evidenceGroupKey: ev.evidenceGroupKey || `GROUP_${idx + 1}`,
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
