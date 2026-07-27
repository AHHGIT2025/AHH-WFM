import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { calculateBillingSupportData } from "@/lib/manpower-billing-support-engine";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const operationType = searchParams.get("operationType") || "SECURITY_GUARDING";

  const auth = await checkApiAuth(undefined, {
    requiredOperation: operationType as "SECURITY_GUARDING" | "FACILITY_MANAGEMENT"
  });
  if (auth.error) return auth.error;

  const period = searchParams.get("period") || new Date().toISOString().substring(0, 7);
  const clientId = searchParams.get("clientId") || undefined;
  const contractId = searchParams.get("contractId") || undefined;
  const projectId = searchParams.get("projectId") || undefined;
  const siteId = searchParams.get("siteId") || undefined;
  const userId = auth.session?.user?.id || "AD-0001";

  try {
    const { lines, summary } = await calculateBillingSupportData({
      operationType: operationType as any,
      period,
      clientId: clientId === "all" ? undefined : clientId,
      contractId,
      projectId,
      siteId,
      calculatedBy: userId
    });

    return NextResponse.json({
      success: true,
      period,
      operationType,
      summary,
      billingLines: lines
    });
  } catch (error: any) {
    console.error("Failed to generate billing support preview:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
