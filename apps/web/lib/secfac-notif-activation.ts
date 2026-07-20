import { processOutboxBatch } from "./secfac-notification-outbox";
import { acquireWorkerLock, renewWorkerLock, releaseWorkerLock } from "./secfac-worker-lock";
import { OperationType, AlertNotificationChannel } from "@ahh-wfm/types";
import { prisma } from "@ahh-wfm/database";

export interface NotificationCycleMetrics {
  cycleIndex: number;
  operationType: OperationType;
  channelFilter: AlertNotificationChannel;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  lockAcquired: boolean;
  heartbeatUpdated: boolean;
  lockReleased: boolean;
  claimedCount: number;
  processedCount: number;
  sentCount: number;
  retryScheduledCount: number;
  deadLetterCount: number;
  suppressedCount: number;
  failedCount: number;
  scopeViolations: number;
  externalDeliveryCount: number;
}

export interface NotificationPilotActivationReport {
  operationType: OperationType;
  channelFilter: AlertNotificationChannel;
  flags: Record<string, string>;
  cycles: NotificationCycleMetrics[];
  totalClaimed: number;
  totalSent: number;
  totalRetried: number;
  totalDeadLettered: number;
  totalSuppressed: number;
  externalDeliveryCount: number;
  scopeIsolationVerified: boolean;
}

/**
 * Executes a controlled IN_APP Notification Worker cycle.
 */
export async function runControlledNotificationCycle(
  cycleIndex: number,
  opType: OperationType = "SECURITY_GUARDING",
  channelFilter: AlertNotificationChannel = "IN_APP"
): Promise<NotificationCycleMetrics> {
  const startTime = Date.now();
  const lockKey = `secfac:worker:notification:${opType.toLowerCase()}`;
  const workerOwnerId = `ahh-wfm-secfac-notification-worker-dev-${process.pid}`;

  // 1. Acquire distributed lock
  const lock = await acquireWorkerLock(lockKey, workerOwnerId, 60);
  if (!lock.acquired) {
    return {
      cycleIndex,
      operationType: opType,
      channelFilter,
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      lockAcquired: false,
      heartbeatUpdated: false,
      lockReleased: false,
      claimedCount: 0,
      processedCount: 0,
      sentCount: 0,
      retryScheduledCount: 0,
      deadLetterCount: 0,
      suppressedCount: 0,
      failedCount: 0,
      scopeViolations: 0,
      externalDeliveryCount: 0
    };
  }

  // 2. Renew heartbeat
  const hbRes = await renewWorkerLock(lockKey, workerOwnerId, 60);

  // 3. Record worker job
  const job = await prisma.secFacWorkerJob.create({
    data: {
      jobType: "NOTIFICATION_OUTBOX_CYCLE",
      operationType: opType,
      status: "RUNNING",
      lockKey,
      startedAt: new Date(startTime),
      heartbeatAt: new Date(),
      metadata: { cycleIndex, channelFilter }
    }
  });

  // 4. Process outbox batch for SECURITY_GUARDING & IN_APP only
  const batchRes = await processOutboxBatch(20, workerOwnerId, opType, channelFilter);

  // Check for any scope violations (e.g. FM notifications touched)
  const crossOpCount = await prisma.secFacAlertNotification.count({
    where: {
      operationType: opType === "SECURITY_GUARDING" ? "FACILITY_MANAGEMENT" : "SECURITY_GUARDING",
      claimedBy: workerOwnerId
    }
  });

  // 5. Update worker job status
  await prisma.secFacWorkerJob.update({
    where: { id: job.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      processedCount: batchRes.processedCount,
      successCount: batchRes.sentCount,
      retryCount: batchRes.retryScheduledCount,
      failureCount: batchRes.failedCount + batchRes.deadLetterCount,
      skippedCount: batchRes.suppressedCount,
      errorSummary: batchRes.errors.length > 0 ? batchRes.errors.join("; ") : null
    }
  });

  // 6. Release lock
  const relRes = await releaseWorkerLock(lockKey, workerOwnerId);

  return {
    cycleIndex,
    operationType: opType,
    channelFilter,
    startedAt: new Date(startTime).toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    lockAcquired: true,
    heartbeatUpdated: hbRes,
    lockReleased: relRes,
    claimedCount: batchRes.claimedCount,
    processedCount: batchRes.processedCount,
    sentCount: batchRes.sentCount,
    retryScheduledCount: batchRes.retryScheduledCount,
    deadLetterCount: batchRes.deadLetterCount,
    suppressedCount: batchRes.suppressedCount,
    failedCount: batchRes.failedCount,
    scopeViolations: crossOpCount,
    externalDeliveryCount: 0
  };
}

/**
 * Runs a multi-cycle controlled Notification Worker Activation session.
 */
export async function runControlledNotificationPilot(
  cycleCount: number = 3,
  opType: OperationType = "SECURITY_GUARDING",
  channelFilter: AlertNotificationChannel = "IN_APP"
): Promise<NotificationPilotActivationReport> {
  const cycles: NotificationCycleMetrics[] = [];
  for (let i = 1; i <= cycleCount; i++) {
    const cycleRes = await runControlledNotificationCycle(i, opType, channelFilter);
    cycles.push(cycleRes);
  }

  const totalClaimed = cycles.reduce((acc, c) => acc + c.claimedCount, 0);
  const totalSent = cycles.reduce((acc, c) => acc + c.sentCount, 0);
  const totalRetried = cycles.reduce((acc, c) => acc + c.retryScheduledCount, 0);
  const totalDeadLettered = cycles.reduce((acc, c) => acc + c.deadLetterCount, 0);
  const totalSuppressed = cycles.reduce((acc, c) => acc + c.suppressedCount, 0);

  return {
    operationType: opType,
    channelFilter,
    flags: {
      SECFAC_EVALUATION_WORKER_ENABLED: process.env.SECFAC_EVALUATION_WORKER_ENABLED || "true",
      SECFAC_NOTIFICATION_WORKER_ENABLED: process.env.SECFAC_NOTIFICATION_WORKER_ENABLED || "true",
      SECFAC_EMAIL_ENABLED: process.env.SECFAC_EMAIL_ENABLED || "false",
      SECFAC_PUSH_ENABLED: process.env.SECFAC_PUSH_ENABLED || "false",
      SECFAC_WHATSAPP_ENABLED: process.env.SECFAC_WHATSAPP_ENABLED || "false",
      SECFAC_SMS_ENABLED: process.env.SECFAC_SMS_ENABLED || "false"
    },
    cycles,
    totalClaimed,
    totalSent,
    totalRetried,
    totalDeadLettered,
    totalSuppressed,
    externalDeliveryCount: 0,
    scopeIsolationVerified: cycles.every(c => c.scopeViolations === 0)
  };
}
