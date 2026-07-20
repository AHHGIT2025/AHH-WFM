import { processOutboxBatch } from "../lib/secfac-notification-outbox";
import { acquireWorkerLock, renewWorkerLock, releaseWorkerLock } from "../lib/secfac-worker-lock";
import { prisma } from "@ahh-wfm/database";

const WORKER_ID = `secfac-notification-worker-${process.pid}`;
const LOCK_KEY = "secfac:worker:notification-scheduler";
const POLL_INTERVAL_MS = Number(process.env.SECFAC_NOTIFICATION_POLL_INTERVAL_MS) || 10000;
const BATCH_SIZE = Number(process.env.SECFAC_NOTIFICATION_BATCH_SIZE) || 20;

let isShuttingDown = false;

async function runWorkerCycle(): Promise<void> {
  if (isShuttingDown) return;

  const isEnabled = process.env.SECFAC_NOTIFICATION_WORKER_ENABLED === "true";
  if (!isEnabled) {
    // Feature flag disabled — sleep safely
    return;
  }

  // Acquire worker lock to prevent multi-instance queue contention
  const lock = await acquireWorkerLock(LOCK_KEY, WORKER_ID, 60);
  if (!lock.acquired) {
    return;
  }

  const job = await prisma.secFacWorkerJob.create({
    data: {
      jobType: "NOTIFICATION_OUTBOX_CYCLE",
      status: "RUNNING",
      lockKey: LOCK_KEY,
      startedAt: new Date(),
      heartbeatAt: new Date()
    }
  });

  try {
    const result = await processOutboxBatch(BATCH_SIZE, WORKER_ID);

    await prisma.secFacWorkerJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        processedCount: result.processedCount,
        successCount: result.sentCount,
        retryCount: result.retryScheduledCount,
        failureCount: result.failedCount + result.deadLetterCount,
        skippedCount: result.suppressedCount,
        errorSummary: result.errors.length > 0 ? result.errors.join("; ") : null
      }
    });

    await renewWorkerLock(LOCK_KEY, WORKER_ID, 60);
  } catch (e: any) {
    console.error(`[SecFac Notification Worker] Cycle error:`, e);
    await prisma.secFacWorkerJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorSummary: e?.message || String(e)
      }
    });
  } finally {
    await releaseWorkerLock(LOCK_KEY, WORKER_ID);
  }
}

async function startWorkerLoop(): Promise<void> {
  console.log(`[SecFac Notification Worker] Started (ID: ${WORKER_ID}, Poll Interval: ${POLL_INTERVAL_MS}ms, Enabled: ${process.env.SECFAC_NOTIFICATION_WORKER_ENABLED === "true"})`);

  while (!isShuttingDown) {
    await runWorkerCycle();
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  console.log(`[SecFac Notification Worker] Gracefully stopped.`);
}

function setupShutdownHandlers(): void {
  const shutdown = async (signal: string) => {
    console.log(`[SecFac Notification Worker] Received ${signal}. Shutting down...`);
    isShuttingDown = true;
    await releaseWorkerLock(LOCK_KEY, WORKER_ID);
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

if (require.main === module) {
  setupShutdownHandlers();
  startWorkerLoop().catch(e => {
    console.error("[SecFac Notification Worker] Fatal startup error:", e);
    process.exit(1);
  });
}
