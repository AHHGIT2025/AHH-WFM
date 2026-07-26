import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { calculatePayrollInputData } from "@/lib/manpower-payroll-input-engine";
import { mockDb } from "@ahh-wfm/mock-data";

export async function GET(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || new Date().toISOString().substring(0, 7);
  const userId = auth.session?.user?.id || "AD-0001";

  try {
    const { lines } = await calculatePayrollInputData({
      operationType: "SECURITY_GUARDING",
      period,
      calculatedBy: userId
    });

    const locks = await mockDb.getSecurityOperationsPeriodLocks("SECURITY_GUARDING");
    const isLocked = locks.some(l => l.period === period && l.locked);

    const advisories = lines.map((l: any, idx: number) => ({
      id: `adv-legacy-${idx}-${l.employeeId}`,
      date: `${period}-01`,
      employeeId: l.employeeId,
      employeeName: l.employeeNameSnapshot,
      employeeCode: l.employeeCodeSnapshot,
      designation: "Security Guard",
      siteId: l.siteId || "",
      siteName: l.siteNameSnapshot || "Site",
      shiftCode: "DAY",
      hoursWorked: Math.round((l.regularVerifiedMinutes / 60) * 10) / 10,
      attendanceStatus: l.regularWorkedDays > 0 ? "Present" : "No Show",
      checkIn: null,
      checkOut: null,
      attendanceRemarks: "",
      actingDuty: l.actingDutyCandidateDays > 0 ? {
        scheduledDesignation: "Supervisor",
        actualDesignation: "Security Guard",
        advisory: "Acting duty rate adjustment recommended."
      } : null,
      allowance: l.siteAllowanceCandidateDays > 0 ? {
        allowanceId: "SA-01",
        description: "Site Duty Allowance",
        frequency: "MONTHLY",
        amountAdvisory: 0
      } : null,
      unresolvedExceptionsCount: l.reconciliationStatus !== "MATCHED" ? 1 : 0,
      isOverridden: false,
      overrides: []
    }));

    return NextResponse.json({
      success: true,
      period,
      isLocked,
      advisories,
      notice: "Operational Payroll Advisory Only — No Payroll Posting"
    });
  } catch (error: any) {
    console.error("Failed to fetch legacy security payroll advisory list:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
