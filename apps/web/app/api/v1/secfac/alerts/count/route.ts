import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { getOperationalAlertCount } from "@/lib/secfac-alert-service";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const operationTypeParam = searchParams.get("operationType");

  if (!operationTypeParam || !["SECURITY_GUARDING", "FACILITY_MANAGEMENT"].includes(operationTypeParam)) {
    return NextResponse.json(
      { error: "Explicit valid operationType parameter ('SECURITY_GUARDING' or 'FACILITY_MANAGEMENT') is required." },
      { status: 400 }
    );
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: operationTypeParam as any,
    requiredPermission: "secfac.alerts.view"
  });
  if (auth.error) return auth.error;

  try {
    const summary = await getOperationalAlertCount(operationTypeParam as any);
    return NextResponse.json(summary);
  } catch (e: any) {
    console.error("GET /api/v1/secfac/alerts/count error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
