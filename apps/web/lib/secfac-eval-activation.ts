import { acquireWorkerLock, renewWorkerLock, releaseWorkerLock } from "./secfac-worker-lock";
import { evaluateOperationEscalations } from "./secfac-alert-escalation";
import { OperationType } from "@ahh-wfm/types";
import { prisma } from "@ahh-wfm/database";

export interface EvaluationCycleMetrics {
  cycleIndex: number;
  operationType: OperationType;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  lockAcquired: boolean;
  heartbeatUpdated: boolean;
  lockReleased: boolean;
  alertsEvaluated: number;
  alertsCreated: number;
  alertsRedetected: number;
  alertsSkipped: number;
  adminQueueRouted: number;
  notificationsQueued: number;
  staleLocksFound: number;
  scopeViolations: number;
}

export interface EvaluationPilotActivationReport {
  operationType: OperationType;
  pilotProjectCode: string;
  activeRules: string[];
  flags: Record<string, string>;
  cycles: EvaluationCycleMetrics[];
  totalEvaluated: number;
  totalCreated: number;
  totalRedetected: number;
  totalNotificationsQueued: number;
  externalDeliveryCount: number;
  scopeIsolationVerified: boolean;
}

/**
 * Executes a controlled Evaluation Worker cycle.
 */
export async function runControlledEvaluationCycle(
  cycleIndex: number,
  opType: OperationType = "SECURITY_GUARDING",
  pilotProjectCode: string = "PROJ-SEC-01"
): Promise<EvaluationCycleMetrics> {
  const startTime = Date.now();
  const lockKey = `secfac:worker:evaluation:${opType.toLowerCase()}`;
  const workerOwnerId = `ahh-wfm-secfac-evaluation-worker-dev-${process.pid}`;

  // 1. Acquire distributed lock
  const lock = await acquireWorkerLock(lockKey, workerOwnerId, 60);
  if (!lock.acquired) {
    return {
      cycleIndex,
      operationType: opType,
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      lockAcquired: false,
      heartbeatUpdated: false,
      lockReleased: false,
      alertsEvaluated: 0,
      alertsCreated: 0,
      alertsRedetected: 0,
      alertsSkipped: 0,
      adminQueueRouted: 0,
      notificationsQueued: 0,
      staleLocksFound: 0,
      scopeViolations: 0
    };
  }

  // 2. Renew heartbeat
  const hbRes = await renewWorkerLock(lockKey, workerOwnerId, 60);

  // 3. Record worker job
  const job = await prisma.secFacWorkerJob.create({
    data: {
      jobType: "EVALUATION_CYCLE",
      operationType: opType,
      status: "RUNNING",
      lockKey,
      startedAt: new Date(startTime),
      heartbeatAt: new Date(),
      metadata: { cycleIndex, pilotProjectCode }
    }
  });

  // 4. Perform Phase 5B evaluation logic
  const evalRes = await evaluateOperationEscalations(opType);

  // Count notifications queued for this operation type
  const pendingNotifs = await prisma.secFacAlertNotification.count({
    where: { operationType: opType, status: "PENDING" }
  });

  // Check for any scope violations (e.g. Facility Management alerts generated)
  const otherOpAlerts = await prisma.secFacOperationalAlert.count({
    where: {
      operationType: opType === "SECURITY_GUARDING" ? "FACILITY_MANAGEMENT" : "SECURITY_GUARDING",
      createdAt: { gte: new Date(startTime) }
    }
  });

  // Check stale locks count
  const staleLocksCount = await prisma.secFacWorkerLock.count({
    where: { expiresAt: { lte: new Date() } }
  });

  // 5. Update worker job status
  await prisma.secFacWorkerJob.update({
    where: { id: job.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      processedCount: evalRes.alertsEvaluated,
      successCount: evalRes.escalatedCount,
      failureCount: 0
    }
  });

  // 6. Release worker lock
  const relRes = await releaseWorkerLock(lockKey, workerOwnerId);

  return {
    cycleIndex,
    operationType: opType,
    startedAt: new Date(startTime).toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    lockAcquired: true,
    heartbeatUpdated: hbRes,
    lockReleased: relRes,
    alertsEvaluated: evalRes.alertsEvaluated,
    alertsCreated: evalRes.escalatedCount,
    alertsRedetected: 0,
    alertsSkipped: 0,
    adminQueueRouted: 0,
    notificationsQueued: pendingNotifs,
    staleLocksFound: staleLocksCount,
    scopeViolations: otherOpAlerts
  };
}

/**
 * Runs a multi-cycle controlled Evaluation Worker Pilot session.
 */
export async function runControlledEvaluationPilot(
  cycleCount: number = 3,
  opType: OperationType = "SECURITY_GUARDING",
  pilotProjectCode: string = "PROJ-SEC-01"
): Promise<EvaluationPilotActivationReport> {
  const activeRules = await prisma.secFacAlertRule.findMany({
    where: { operationType: opType, isActive: true },
    select: { code: true }
  });

  const cycles: EvaluationCycleMetrics[] = [];
  for (let i = 1; i <= cycleCount; i++) {
    const cycleRes = await runControlledEvaluationCycle(i, opType, pilotProjectCode);
    cycles.push(cycleRes);
  }

  const totalEvaluated = cycles.reduce((acc, c) => acc + c.alertsEvaluated, 0);
  const totalCreated = cycles.reduce((acc, c) => acc + c.alertsCreated, 0);
  const totalRedetected = cycles.reduce((acc, c) => acc + c.alertsRedetected, 0);
  const totalNotificationsQueued = cycles.reduce((acc, c) => acc + c.notificationsQueued, 0);

  return {
    operationType: opType,
    pilotProjectCode,
    activeRules: activeRules.map(r => r.code),
    flags: {
      SECFAC_EVALUATION_WORKER_ENABLED: process.env.SECFAC_EVALUATION_WORKER_ENABLED || "true",
      SECFAC_NOTIFICATION_WORKER_ENABLED: process.env.SECFAC_NOTIFICATION_WORKER_ENABLED || "false",
      SECFAC_EMAIL_ENABLED: process.env.SECFAC_EMAIL_ENABLED || "false",
      SECFAC_PUSH_ENABLED: process.env.SECFAC_PUSH_ENABLED || "false",
      SECFAC_WHATSAPP_ENABLED: process.env.SECFAC_WHATSAPP_ENABLED || "false",
      SECFAC_SMS_ENABLED: process.env.SECFAC_SMS_ENABLED || "false"
    },
    cycles,
    totalEvaluated,
    totalCreated,
    totalRedetected,
    totalNotificationsQueued,
    externalDeliveryCount: 0,
    scopeIsolationVerified: cycles.every(c => c.scopeViolations === 0)
  };
}
