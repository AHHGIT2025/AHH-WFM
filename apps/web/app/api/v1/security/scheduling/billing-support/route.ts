import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { calculateBillingSupportData } from "@/lib/manpower-billing-support-engine";

export async function GET(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || new Date().toISOString().substring(0, 7);
  const clientId = searchParams.get("clientId") || "all";
  const userId = auth.session?.user?.id || "AD-0001";

  try {
    const { lines } = await calculateBillingSupportData({
      operationType: "SECURITY_GUARDING",
      period,
      clientId: clientId === "all" ? undefined : clientId,
      calculatedBy: userId
    });

    const billingLines = lines.map((l: any, idx: number) => ({
      id: `bill-legacy-${idx}-${l.businessDate}`,
      date: l.businessDate,
      clientName: l.clientNameSnapshot,
      contractCode: l.contractCodeSnapshot,
      projectName: l.projectNameSnapshot,
      siteName: l.siteNameSnapshot,
      position: l.positionCategory,
      plannedManpower: l.plannedManpower,
      actualManpower: l.assignedManpower,
      actualHours: Math.round((l.verifiedAttendedMinutes / 60) * 10) / 10,
      relieversUsed: l.relieverSubstitutionCount,
      billableAdvisoryQty: l.billableAdvisoryQuantity,
      comments: l.notes
    }));

    return NextResponse.json({
      success: true,
      period,
      billingLines
    });
  } catch (error: any) {
    console.error("Failed to generate legacy security billing support data:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
