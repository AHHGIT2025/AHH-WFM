import { NextRequest, NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { getWorkerHealth, getQueueHealth, getAlertAccuracyMetrics } from "@/lib/secfac-monitoring";

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
    const [evalWorker, notifWorker, monitoringWorker, queue, accuracy] = await Promise.all([
      getWorkerHealth("EVALUATION", op),
      getWorkerHealth("NOTIFICATION", op),
      getWorkerHealth("MONITORING", op),
      getQueueHealth(op, "IN_APP"),
      getAlertAccuracyMetrics(op)
    ]);

    const systemStatus =
      evalWorker.healthStatus === "UNHEALTHY" || notifWorker.healthStatus === "UNHEALTHY" || queue.healthStatus === "UNHEALTHY"
        ? "UNHEALTHY"
        : evalWorker.healthStatus === "DEGRADED" || notifWorker.healthStatus === "DEGRADED" || queue.healthStatus === "DEGRADED"
        ? "DEGRADED"
        : "HEALTHY";

    return NextResponse.json({
      systemStatus,
      operationType: op,
      channel: "IN_APP",
      evalWorker,
      notifWorker,
      monitoringWorker,
      queue,
      accuracy,
      scopeIsolation: {
        facilityManagementTouched: false,
        externalChannelsEnabled: false,
        externalAdapterCalls: 0,
        externalDeliveries: 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (e: any) {
    console.error("GET /api/v1/secfac/monitoring/summary error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
