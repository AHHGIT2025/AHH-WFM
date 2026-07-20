import { evaluateOperationEscalations } from "../lib/secfac-alert-escalation";
import { acquireWorkerLock, renewWorkerLock, releaseWorkerLock, WorkerDatabaseError } from "../lib/secfac-worker-lock";
import { OperationType } from "@ahh-wfm/types";
import { prisma } from "@ahh-wfm/database";

const WORKER_ID = `secfac-evaluation-worker-${process.pid}`;
const EVALUATION_INTERVAL_MS = Number(process.env.SECFAC_EVALUATION_INTERVAL_MS) || 300000; // 5 minutes
let isShuttingDown = false;

// ─── Pilot scope: SECURITY_GUARDING only ─────────────────────────────────────
const PILOT_SCOPE: OperationType[] = ["SECURITY_GUARDING"];

/**
 * Startup assertion — fails fast with a clear message if the Prisma client
 * failed to initialise.  This must never be silently swallowed as a lock-
 * contention event.
 */
function assertPrismaClient(): void {
  if (!prisma || typeof prisma.$transaction !== "function") {
    throw new Error(
      "[SecFac Evaluation Worker] FATAL: Prisma client is undefined or $transaction is not callable. " +
      "Check that the database package was compiled correctly and the generated client is present."
    );
  }
}

async function runEvaluationCycleForScope(opType: OperationType): Promise<void> {
  const lockKey = `secfac:worker:evaluation:${opType.toLowerCase()}`;
  let lock;

  try {
    lock = await acquireWorkerLock(lockKey, WORKER_ID, 120);
  } catch (e: any) {
    // WorkerDatabaseError means a real DB failure — log and re-throw so the
    // outer loop can decide whether to abort or continue.  Do NOT treat it as
    // ordinary lock contention.
    if (e instanceof WorkerDatabaseError) {
      console.error(`[SecFac Evaluation Worker] DATABASE ERROR acquiring lock '${lockKey}':`, e.message);
      throw e;
    }
    throw e;
  }

  if (!lock.acquired) {
    console.log(`[SecFac Evaluation Worker] Lock '${lockKey}' is held — skipping cycle.`);
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

  // Pilot scope: SECURITY_GUARDING only.
  // Facility Management must not be evaluated during this pilot.
  for (const scope of PILOT_SCOPE) {
    await runEvaluationCycleForScope(scope);
  }
}

async function startWorkerLoop(): Promise<void> {
  // Fail fast on a broken Prisma client — never silently continue.
  assertPrismaClient();

  console.log(
    `[SecFac Evaluation Worker] Started — ` +
    `ID: ${WORKER_ID} | Scope: ${PILOT_SCOPE.join(",")} | ` +
    `Interval: ${EVALUATION_INTERVAL_MS}ms | ` +
    `Enabled: ${process.env.SECFAC_EVALUATION_WORKER_ENABLED === "true"}`
  );

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
    // Release only the SECURITY_GUARDING lock — FM is never held by this worker.
    await releaseWorkerLock("secfac:worker:evaluation:security_guarding", WORKER_ID);
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
