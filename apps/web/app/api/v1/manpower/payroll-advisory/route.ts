import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { calculatePayrollInputData } from "@/lib/manpower-payroll-input-engine";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const operationType = searchParams.get("operationType") || "SECURITY_GUARDING";

  const auth = await checkApiAuth(undefined, {
    requiredOperation: operationType as "SECURITY_GUARDING" | "FACILITY_MANAGEMENT"
  });
  if (auth.error) return auth.error;

  const period = searchParams.get("period") || new Date().toISOString().substring(0, 7);
  const siteId = searchParams.get("siteId") || undefined;
  const employeeId = searchParams.get("employeeId") || undefined;
  const userId = auth.session?.user?.id || "AD-0001";

  try {
    const { lines, overallReadiness, summary } = await calculatePayrollInputData({
      operationType,
      period,
      siteId,
      employeeId,
      calculatedBy: userId
    });

    return NextResponse.json({
      success: true,
      period,
      operationType,
      overallReadiness,
      summary,
      advisories: lines,
      notice: "Operational Payroll Advisory Only — No Payroll Posting"
    });
  } catch (error: any) {
    console.error("Failed to generate payroll input preview:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
