import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { runControlledEvaluationPilot } from "@/lib/secfac-eval-activation";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { operationType, cycleCount, pilotProjectCode } = body;

  const op = operationType || "SECURITY_GUARDING";
  if (!["SECURITY_GUARDING", "FACILITY_MANAGEMENT"].includes(op)) {
    return NextResponse.json({ error: "Explicit valid operationType parameter is required." }, { status: 400 });
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: op as any,
    requiredPermission: "secfac.workers.manage"
  });
  if (auth.error) return auth.error;

  try {
    const report = await runControlledEvaluationPilot(
      cycleCount || 3,
      op as any,
      pilotProjectCode || "PROJ-SEC-01"
    );

    return NextResponse.json(report);
  } catch (e: any) {
    console.error("POST /api/v1/secfac/eval-worker/run error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
