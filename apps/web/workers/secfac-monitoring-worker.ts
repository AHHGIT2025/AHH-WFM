import { prisma } from "@ahh-wfm/database";
import { acquireWorkerLock, renewWorkerLock, releaseWorkerLock, WorkerDatabaseError } from "../lib/secfac-worker-lock";
import { captureMonitoringSnapshot, getQueueHealth, getWorkerHealth, createMonitoringAlertIfBreached } from "../lib/secfac-monitoring";

/**
 * Startup assertion — fails fast if Prisma client is broken.
 */
function assertPrismaClient(): void {
  if (!prisma || typeof prisma.$transaction !== "function") {
    throw new Error(
      "[SecFac Monitoring Worker] FATAL: Prisma client is undefined or $transaction is not callable. " +
      "Check that the database package was compiled correctly and the generated client is present."
    );
  }
}

export interface MonitoringWorkerResult {
  startedAt: Date;
  completedAt: Date;
  operationType: string;
  evalWorkerStatus: string;
  notifWorkerStatus: string;
  queueStatus: string;
  snapshotId: string;
  warningsDetected: number;
}

export async function runMonitoringWorkerCycle(
  operationType: string = "SECURITY_GUARDING",
  ownerId: string = `worker:monitoring:${process.pid}`
): Promise<MonitoringWorkerResult> {
  const isEnabled = process.env.SECFAC_MONITORING_WORKER_ENABLED !== "false";
  if (!isEnabled) {
    throw new Error("Monitoring worker is disabled via environment variable SECFAC_MONITORING_WORKER_ENABLED=false.");
  }

  const lockKey = `secfac:worker:monitoring:${operationType.toLowerCase()}`;
  const startedAt = new Date();

  // WorkerDatabaseError must not be treated as lock contention.
  let lockAcquired;
  try {
    lockAcquired = await acquireWorkerLock(lockKey, ownerId, 300);
  } catch (e: any) {
    if (e instanceof WorkerDatabaseError) {
      throw new Error(
        `[SecFac Monitoring Worker] DATABASE ERROR — cannot acquire lock '${lockKey}': ${e.message}`
      );
    }
    throw e;
  }

  if (!lockAcquired.acquired) {
    throw new Error(`Failed to acquire lock ${lockKey}: lock is currently held by another monitoring instance.`);
  }

  try {
    await renewWorkerLock(lockKey, ownerId, 300);

    const evalHealth = await getWorkerHealth("EVALUATION", operationType);
    const notifHealth = await getWorkerHealth("NOTIFICATION", operationType);
    const queueHealth = await getQueueHealth(operationType, "IN_APP");

    const snapshot = await captureMonitoringSnapshot(
      operationType,
      "WORKER_HEALTH",
      "secfac-monitoring-worker",
      {
        evalStatus: evalHealth.healthStatus,
        notifStatus: notifHealth.healthStatus,
        queueStatus: queueHealth.healthStatus
      }
    );

    if (evalHealth.healthStatus === "UNHEALTHY" || evalHealth.healthStatus === "DEGRADED") {
      await createMonitoringAlertIfBreached(
        "WORKER_EVAL_UNHEALTHY",
        evalHealth.healthStatus === "UNHEALTHY" ? "CRITICAL" : "HIGH",
        `Evaluation Worker ${evalHealth.healthStatus}`,
        evalHealth.healthReason,
        operationType
      );
    }

    if (notifHealth.healthStatus === "UNHEALTHY" || notifHealth.healthStatus === "DEGRADED") {
      await createMonitoringAlertIfBreached(
        "WORKER_NOTIF_UNHEALTHY",
        notifHealth.healthStatus === "UNHEALTHY" ? "CRITICAL" : "HIGH",
        `Notification Worker ${notifHealth.healthStatus}`,
        notifHealth.healthReason,
        operationType
      );
    }

    if (queueHealth.healthStatus !== "HEALTHY") {
      await createMonitoringAlertIfBreached(
        "QUEUE_HEALTH_WARNING",
        queueHealth.severity === "CRITICAL" ? "CRITICAL" : "HIGH",
        `Queue Health ${queueHealth.healthStatus}`,
        queueHealth.warnings.join(" "),
        operationType
      );
    }

    await prisma.secFacWorkerJob.create({
      data: {
        jobType: "MONITORING_CYCLE",
        operationType,
        status: "COMPLETED",
        lockKey,
        startedAt,
        completedAt: new Date(),
        heartbeatAt: new Date(),
        processedCount: 1,
        successCount: 1,
        failureCount: 0,
        metadata: {
          snapshotId: snapshot.id,
          evalHealth: evalHealth.healthStatus,
          notifHealth: notifHealth.healthStatus,
          queueHealth: queueHealth.healthStatus
        }
      }
    });

    await releaseWorkerLock(lockKey, ownerId);

    return {
      startedAt,
      completedAt: new Date(),
      operationType,
      evalWorkerStatus: evalHealth.healthStatus,
      notifWorkerStatus: notifHealth.healthStatus,
      queueStatus: queueHealth.healthStatus,
      snapshotId: snapshot.id,
      warningsDetected: queueHealth.warnings.length
    };
  } catch (e: any) {
    await releaseWorkerLock(lockKey, ownerId).catch(() => {});
    throw e;
  }
}

const WORKER_ID = `secfac-monitoring-worker-${process.pid}`;
const MONITORING_INTERVAL_MS = Number(process.env.SECFAC_MONITORING_INTERVAL_MS) || 300000; // 5 minutes
let isShuttingDown = false;
let isCycleRunning = false;

async function runFullMonitoringCycle(): Promise<void> {
  if (isShuttingDown || isCycleRunning) return;

  const isEnabled = process.env.SECFAC_MONITORING_WORKER_ENABLED !== "false";
  if (!isEnabled) {
    return;
  }

  isCycleRunning = true;
  try {
    const res = await runMonitoringWorkerCycle("SECURITY_GUARDING", WORKER_ID);
    console.log("[secfac-monitoring-worker] Cycle completed:", res);
  } catch (err: any) {
    console.error("[secfac-monitoring-worker] Cycle error:", err?.message || String(err));
  } finally {
    isCycleRunning = false;
  }
}

async function startWorkerLoop(): Promise<void> {
  assertPrismaClient();

  console.log(
    `[secfac-monitoring-worker] Started — ` +
    `ID: ${WORKER_ID} | Scope: SECURITY_GUARDING | ` +
    `Interval: ${MONITORING_INTERVAL_MS}ms | ` +
    `Enabled: ${process.env.SECFAC_MONITORING_WORKER_ENABLED !== "false"}`
  );

  while (!isShuttingDown) {
    await runFullMonitoringCycle();
    await new Promise(resolve => setTimeout(resolve, MONITORING_INTERVAL_MS));
  }

  console.log("[secfac-monitoring-worker] Gracefully stopped.");
}

function setupShutdownHandlers(): void {
  const shutdown = async (signal: string) => {
    console.log(`[secfac-monitoring-worker] Received ${signal}. Shutting down...`);
    isShuttingDown = true;
    await releaseWorkerLock("secfac:worker:monitoring:security_guarding", WORKER_ID).catch(() => {});
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

if (require.main === module) {
  setupShutdownHandlers();
  startWorkerLoop().catch((err) => {
    console.error("[secfac-monitoring-worker] Fatal startup error:", err);
    process.exit(1);
  });
}

