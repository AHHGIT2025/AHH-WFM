import { prisma } from "@ahh-wfm/database";

/**
 * Escapes strings to prevent CSV Formula Injection attacks (=, +, -, @, \t, \r).
 */
export function escapeCsvCell(value: any): string {
  if (value == null) return '""';
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `"'${str.replace(/"/g, '""')}"`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Exports a durable Billing Support Run as a safe CSV payload and audits the action.
 */
export async function exportBillingSupportRunCsv(params: {
  runId: string;
  actorId: string;
  actorEmail?: string;
}): Promise<{ csv: string; run: any }> {
  const run = await prisma.manpowerBillingSupportRun.findUnique({
    where: { id: params.runId },
    include: { lines: true }
  });

  if (!run) {
    throw new Error(`Billing Support Run not found: ${params.runId}`);
  }

  const headers = [
    "Run Code",
    "Version",
    "Operation Type",
    "Period",
    "Business Date",
    "Client",
    "Contract Code",
    "Project",
    "Site",
    "Position Category",
    "Planned Manpower",
    "Planned Post Minutes",
    "Assigned Manpower",
    "Verified Present",
    "Verified Attended Minutes",
    "Covered Post Minutes",
    "Shortage Count",
    "Unapproved Extra",
    "Approved Extra",
    "Relievers Used",
    "FOC Reliever Minutes",
    "Billable Advisory Qty",
    "Billing Basis",
    "Warnings"
  ];

  const rows = run.lines.map(l => [
    run.runCode,
    run.version,
    run.operationType,
    run.period,
    l.businessDate.toISOString().split("T")[0],
    l.clientNameSnapshot || "",
    l.contractCodeSnapshot || "",
    l.projectNameSnapshot || "",
    l.siteNameSnapshot || "",
    l.positionCategory || "",
    l.plannedManpower,
    l.plannedPostMinutes,
    l.assignedManpower,
    l.verifiedPresentManpower,
    l.verifiedAttendedMinutes,
    l.coveredPostMinutes,
    l.shortageCount,
    l.unapprovedExtraCount,
    l.approvedExtraCount,
    l.relieverSubstitutionCount,
    l.focRelieverMinutes,
    l.billableAdvisoryQuantity,
    l.billingBasis,
    Array.isArray(l.warningCodes) ? (l.warningCodes as string[]).join("; ") : ""
  ]);

  const csvContent = "\uFEFF" + [
    headers.map(escapeCsvCell).join(","),
    ...rows.map(row => row.map(escapeCsvCell).join(","))
  ].join("\n");

  // Audit export
  try {
    await prisma.userActivityLog.create({
      data: {
        userId: params.actorId,
        action: "EXPORT_BILLING_SUPPORT_RUN",
        entityType: "ManpowerBillingSupportRun",
        entityId: run.id,
        afterJson: JSON.stringify({ runCode: run.runCode, version: run.version, period: run.period, actorEmail: params.actorEmail })
      }
    });
  } catch (e) {}

  await prisma.manpowerBillingSupportRun.update({
    where: { id: run.id },
    data: {
      exportedById: params.actorId,
      exportedAt: new Date(),
      ...(run.status === "LOCKED" || run.status === "REVIEWED" ? { status: "EXPORTED" } : {})
    }
  });

  return { csv: csvContent, run };
}

/**
 * Exports a durable Payroll Input Advisory Run as a safe CSV payload (NO SALARY OR BANK FIELDS) and audits the action.
 */
export async function exportPayrollAdvisoryRunCsv(params: {
  runId: string;
  actorId: string;
  actorEmail?: string;
}): Promise<{ csv: string; run: any }> {
  const run = await prisma.manpowerPayrollAdvisoryRun.findUnique({
    where: { id: params.runId },
    include: { lines: true }
  });

  if (!run) {
    throw new Error(`Payroll Advisory Run not found: ${params.runId}`);
  }

  const headers = [
    "Run Code",
    "Run Version",
    "Work Calendar Version",
    "Holiday Calendar Version",
    "Operation Type",
    "Period",
    "Employee Code",
    "Employee Name",
    "Site",
    "Regular Worked Days",
    "Regular Verified Minutes",
    "Ramadan Worked Minutes",
    "Ramadan Excess Candidate Mins",
    "Overtime Candidate Mins",
    "Public Holiday Worked Days",
    "Public Holiday Worked Mins",
    "Weekly Rest Worked Days",
    "Weekly Rest Worked Mins",
    "Acting Duty Candidate Days",
    "Acting Duty Candidate Mins",
    "Site Allowance Candidate Days",
    "Leave Days",
    "Absence Days",
    "Reconciliation Status",
    "Readiness Status",
    "Advisory Classifications",
    "Warnings"
  ];

  const rows = run.lines.map(l => [
    run.runCode,
    run.version,
    run.workCalendarProfileVersion,
    run.holidayCalendarVersion,
    run.operationType,
    run.period,
    l.employeeCodeSnapshot,
    l.employeeNameSnapshot,
    l.siteNameSnapshot || "",
    l.regularWorkedDays,
    l.regularVerifiedMinutes,
    l.ramadanWorkedMinutes,
    l.ramadanExcessCandidateMinutes,
    l.overtimeCandidateMinutes,
    l.publicHolidayWorkedDays,
    l.publicHolidayWorkedMinutes,
    l.weeklyRestWorkedDays,
    l.weeklyRestWorkedMinutes,
    l.actingDutyCandidateDays,
    l.actingDutyCandidateMinutes,
    l.siteAllowanceCandidateDays,
    l.leaveDays,
    l.absenceDays,
    l.reconciliationStatus,
    l.readinessStatus,
    Array.isArray(l.advisoryClassifications) ? (l.advisoryClassifications as string[]).join("; ") : "",
    Array.isArray(l.advisoryWarnings) ? (l.advisoryWarnings as string[]).join("; ") : ""
  ]);

  const csvContent = "\uFEFF" + [
    headers.map(escapeCsvCell).join(","),
    ...rows.map(row => row.map(escapeCsvCell).join(","))
  ].join("\n");

  // Audit export
  try {
    await prisma.userActivityLog.create({
      data: {
        userId: params.actorId,
        action: "EXPORT_PAYROLL_ADVISORY_RUN",
        entityType: "ManpowerPayrollAdvisoryRun",
        entityId: run.id,
        afterJson: JSON.stringify({ runCode: run.runCode, version: run.version, period: run.period, actorEmail: params.actorEmail })
      }
    });
  } catch (e) {}

  await prisma.manpowerPayrollAdvisoryRun.update({
    where: { id: run.id },
    data: {
      exportedById: params.actorId,
      exportedAt: new Date(),
      ...(run.status === "LOCKED" || run.status === "REVIEWED" ? { status: "EXPORTED" } : {})
    }
  });

  return { csv: csvContent, run };
}
