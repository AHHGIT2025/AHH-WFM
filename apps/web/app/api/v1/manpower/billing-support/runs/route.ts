import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { createDurableBillingRun } from "@/lib/manpower-billing-support-engine";

export async function POST(request: Request) {
  let body: any = {};
  try { body = await request.json(); } catch (e) {}

  const operationType = body.operationType || "SECURITY_GUARDING";
  const auth = await checkApiAuth(undefined, {
    requiredOperation: operationType as "SECURITY_GUARDING" | "FACILITY_MANAGEMENT"
  });
  if (auth.error) return auth.error;

  const period = body.period || new Date().toISOString().substring(0, 7);
  const userId = auth.session?.user?.id || "AD-0001";

  try {
    const run = await createDurableBillingRun({
      operationType,
      period,
      clientId: body.clientId,
      contractId: body.contractId,
      siteId: body.siteId,
      calculatedBy: userId
    });

    return NextResponse.json({
      success: true,
      run
    }, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create durable billing run:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
