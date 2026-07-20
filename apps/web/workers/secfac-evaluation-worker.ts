import { evaluateOperationEscalations } from "../lib/secfac-alert-escalation";
import { acquireWorkerLock, renewWorkerLock, releaseWorkerLock } from "../lib/secfac-worker-lock";
import { OperationType } from "@ahh-wfm/types";
import { prisma } from "@ahh-wfm/database";

const WORKER_ID = `secfac-evaluation-worker-${process.pid}`;
const EVALUATION_INTERVAL_MS = Number(process.env.SECFAC_EVALUATION_INTERVAL_MS) || 300000; // 5 minutes
let isShuttingDown = false;

async function runEvaluationCycleForScope(opType: OperationType): Promise<void> {
  const lockKey = `secfac:worker:evaluation:${opType.toLowerCase()}`;
  const lock = await acquireWorkerLock(lockKey, WORKER_ID, 120);

  if (!lock.acquired) {
    return;
  }

  const job = await prisma.secFacWorkerJob.create({
    data: {
      jobType: "EVALUATION_CYCLE",
      operationType: opType,
      status: "RUNNING",
      lockKey,
      startedAt: new Date(),
      heartbeatAt: new Date()
    }
  });

  try {
    const result = await evaluateOperationEscalations(opType);

    await prisma.secFacWorkerJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        processedCount: result.alertsEvaluated,
        successCount: result.escalatedCount,
        errorSummary: result.warnings.length > 0 ? result.warnings.join("; ") : null
      }
    });

    await renewWorkerLock(lockKey, WORKER_ID, 120);
  } catch (e: any) {
    console.error(`[SecFac Evaluation Worker] Error for '${opType}':`, e);
    await prisma.secFacWorkerJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorSummary: e?.message || String(e)
      }
    });
  } finally {
    await releaseWorkerLock(lockKey, WORKER_ID);
  }
}

async function runFullEvaluationCycle(): Promise<void> {
  if (isShuttingDown) return;

  const isEnabled = process.env.SECFAC_EVALUATION_WORKER_ENABLED === "true";
  if (!isEnabled) {
    // Feature flag disabled — sleep safely
    return;
  }

  await runEvaluationCycleForScope("SECURITY_GUARDING");
  await runEvaluationCycleForScope("FACILITY_MANAGEMENT");
}

async function startWorkerLoop(): Promise<void> {
  console.log(`[SecFac Evaluation Worker] Started (ID: ${WORKER_ID}, Interval: ${EVALUATION_INTERVAL_MS}ms, Enabled: ${process.env.SECFAC_EVALUATION_WORKER_ENABLED === "true"})`);

  while (!isShuttingDown) {
    await runFullEvaluationCycle();
    await new Promise(resolve => setTimeout(resolve, EVALUATION_INTERVAL_MS));
  }

  console.log(`[SecFac Evaluation Worker] Gracefully stopped.`);
}

function setupShutdownHandlers(): void {
  const shutdown = async (signal: string) => {
    console.log(`[SecFac Evaluation Worker] Received ${signal}. Shutting down...`);
    isShuttingDown = true;
    await releaseWorkerLock("secfac:worker:evaluation:security_guarding", WORKER_ID);
    await releaseWorkerLock("secfac:worker:evaluation:facility_management", WORKER_ID);
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

if (require.main === module) {
  setupShutdownHandlers();
  startWorkerLoop().catch(e => {
    console.error("[SecFac Evaluation Worker] Fatal startup error:", e);
    process.exit(1);
  });
}
