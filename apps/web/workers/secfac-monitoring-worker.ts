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

if (require.main === module) {
  // Fail fast on a broken Prisma client before entering the cycle.
  assertPrismaClient();
  runMonitoringWorkerCycle()
    .then((res) => {
      console.log("[secfac-monitoring-worker] Cycle completed:", res);
      process.exit(0);
    })
    .catch((err) => {
      console.error("[secfac-monitoring-worker] Cycle failed:", err);
      process.exit(1);
    });
}

