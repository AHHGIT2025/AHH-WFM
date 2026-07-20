import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { evaluateOperationEscalations } from "@/lib/secfac-alert-escalation";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { operationType } = body;

  if (!operationType || !["SECURITY_GUARDING", "FACILITY_MANAGEMENT"].includes(operationType)) {
    return NextResponse.json(
      { error: "Explicit valid single operationType ('SECURITY_GUARDING' or 'FACILITY_MANAGEMENT') is required." },
      { status: 400 }
    );
  }

  // Elevated authorization check: requires secfac.alerts.manage
  const auth = await checkApiAuth(undefined, {
    requiredOperation: operationType as any,
    requiredPermission: "secfac.alerts.manage"
  });
  if (auth.error) return auth.error;

  try {
    const result = await evaluateOperationEscalations(operationType as any);
    return NextResponse.json({
      operationType,
      evaluated: result.alertsEvaluated,
      escalated: result.escalatedCount,
      warnings: result.warnings
    });
  } catch (e: any) {
    console.error("POST /api/v1/secfac/alerts/evaluate error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
