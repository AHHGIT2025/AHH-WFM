import { executeReconciliationRun } from "../lib/reconciliation-engine";
import { getQatarDateString } from "../lib/roster-engine";

const WORKER_ID = `manpower-reconciliation-worker-${process.pid}`;
const RECONCILIATION_INTERVAL_MS = Number(process.env.RECONCILIATION_WORKER_INTERVAL_MS) || 300000; // 5 minutes
const WORKER_ENABLED = process.env.RECONCILIATION_WORKER_ENABLED !== "false";

let isShuttingDown = false;

async function runReconciliationCycle(): Promise<void> {
  if (isShuttingDown) return;

  const todayStr = getQatarDateString(new Date());
  const scopes: Array<"SECURITY_GUARDING" | "FACILITY_MANAGEMENT"> = ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"];

  for (const operationType of scopes) {
    if (isShuttingDown) break;

    try {
      console.log(`[Manpower Reconciliation Worker] Starting cycle for ${operationType} on ${todayStr}...`);
      const result = await executeReconciliationRun({
        operationType,
        businessDateStr: todayStr,
        runType: "SCHEDULED",
        workerInstanceId: WORKER_ID
      });

      console.log(`[Manpower Reconciliation Worker] Completed cycle for ${operationType}:`, result);
    } catch (error: any) {
      console.error(`[Manpower Reconciliation Worker] Error in cycle for ${operationType}:`, error.message || error);
    }
  }
}

async function workerLoop(): Promise<void> {
  console.log(`[Manpower Reconciliation Worker] Process started (PID: ${process.pid}, Interval: ${RECONCILIATION_INTERVAL_MS}ms)`);

  if (!WORKER_ENABLED) {
    console.log("[Manpower Reconciliation Worker] Disabled via RECONCILIATION_WORKER_ENABLED=false. Standing by...");
  }

  while (!isShuttingDown) {
    if (WORKER_ENABLED) {
      await runReconciliationCycle();
    }
    await new Promise((resolve) => setTimeout(resolve, RECONCILIATION_INTERVAL_MS));
  }

  console.log("[Manpower Reconciliation Worker] Loop terminated cleanly.");
}

process.on("SIGINT", () => {
  console.log("[Manpower Reconciliation Worker] Received SIGINT. Shutting down...");
  isShuttingDown = true;
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("[Manpower Reconciliation Worker] Received SIGTERM. Shutting down...");
  isShuttingDown = true;
  process.exit(0);
});

workerLoop().catch((err) => {
  console.error("[Manpower Reconciliation Worker] Unhandled fatal error:", err);
  process.exit(1);
});
