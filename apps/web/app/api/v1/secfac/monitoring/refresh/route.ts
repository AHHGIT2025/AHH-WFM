import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { runMonitoringWorkerCycle } from "@/workers/secfac-monitoring-worker";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const op = body.operationType || "SECURITY_GUARDING";

  if (!["SECURITY_GUARDING", "FACILITY_MANAGEMENT"].includes(op)) {
    return NextResponse.json({ error: "Explicit valid operationType parameter is required." }, { status: 400 });
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: op as any,
    requiredPermission: "secfac.workers.manage"
  });
  if (auth.error) return auth.error;

  try {
    const report = await runMonitoringWorkerCycle(op, `api-refresh:${auth.session?.user?.id || "admin"}`);
    return NextResponse.json(report);
  } catch (e: any) {
    console.error("POST /api/v1/secfac/monitoring/refresh error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
