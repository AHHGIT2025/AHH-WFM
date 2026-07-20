import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { getWorkerHealth } from "@/lib/secfac-monitoring";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const op = searchParams.get("operationType") || "SECURITY_GUARDING";

  if (!["SECURITY_GUARDING", "FACILITY_MANAGEMENT"].includes(op)) {
    return NextResponse.json({ error: "Explicit valid operationType parameter is required." }, { status: 400 });
  }

  const auth = await checkApiAuth(undefined, {
    requiredOperation: op as any,
    requiredPermission: "secfac.workers.view"
  });
  if (auth.error) return auth.error;

  try {
    const [evalWorker, notifWorker, monitoringWorker] = await Promise.all([
      getWorkerHealth("EVALUATION", op),
      getWorkerHealth("NOTIFICATION", op),
      getWorkerHealth("MONITORING", op)
    ]);

    return NextResponse.json({
      operationType: op,
      workers: [evalWorker, notifWorker, monitoringWorker],
      timestamp: new Date().toISOString()
    });
  } catch (e: any) {
    console.error("GET /api/v1/secfac/monitoring/workers error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
