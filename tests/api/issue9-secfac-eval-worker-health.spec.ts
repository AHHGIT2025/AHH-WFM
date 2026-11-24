import { prisma } from "@ahh-wfm/database";
import {
  getWorkerHealth,
  createMonitoringAlertIfBreached,
  resolveMonitoringAlertsOnRecovery,
} from "../../apps/web/lib/secfac-monitoring";
import { recordEvaluationIdleHeartbeat } from "../../apps/web/workers/secfac-evaluation-worker";
import { runMonitoringWorkerCycle } from "../../apps/web/workers/secfac-monitoring-worker";

describe("Issue #9: SECFAC Evaluation Worker Heartbeat & Monitoring Alert Lifecycle (TEST DATABASE)", () => {
  const opType = "SECURITY_GUARDING";
  const evalLockKey = "secfac:worker:evaluation:security_guarding";
  const notifLockKey = "secfac:worker:notification:security_guarding";
  const monLockKey = "secfac:worker:monitoring:security_guarding";

  const prevEvalEnabled = process.env.SECFAC_EVALUATION_WORKER_ENABLED;
  const prevNotifEnabled = process.env.SECFAC_NOTIFICATION_WORKER_ENABLED;
  const prevMonEnabled = process.env.SECFAC_MONITORING_WORKER_ENABLED;

  const cleanupTestRows = async () => {
    await prisma.secFacOperationalAlert.deleteMany({
      where: { operationType: opType, sourceType: "MONITORING_ENGINE" },
    });
    await prisma.secFacMonitoringSnapshot.deleteMany({ where: { operationType: opType } });
    await prisma.secFacWorkerJob.deleteMany({
      where: { lockKey: { in: [evalLockKey, notifLockKey, monLockKey] } },
    });
    await prisma.secFacWorkerLock.deleteMany({
      where: { lockKey: { in: [evalLockKey, notifLockKey, monLockKey] } },
    });
  };

  beforeEach(async () => {
    process.env.SECFAC_EVALUATION_WORKER_ENABLED = "true";
    process.env.SECFAC_NOTIFICATION_WORKER_ENABLED = "true";
    process.env.SECFAC_MONITORING_WORKER_ENABLED = "true";
    await cleanupTestRows();
  });

  afterAll(async () => {
    await cleanupTestRows();
    process.env.SECFAC_EVALUATION_WORKER_ENABLED = prevEvalEnabled;
    process.env.SECFAC_NOTIFICATION_WORKER_ENABLED = prevNotifEnabled;
    process.env.SECFAC_MONITORING_WORKER_ENABLED = prevMonEnabled;
    await prisma.$disconnect();
  });

  it("1. Idle COMPLETED evaluation worker keeps HEALTHY status via recordEvaluationIdleHeartbeat", async () => {
    const startedAt = new Date(Date.now() - 180000); // 180s ago (would be DEGRADED without idle heartbeat)
    await prisma.secFacWorkerJob.create({
      data: {
        jobType: "EVALUATION_CYCLE",
        operationType: opType,
        status: "COMPLETED",
        lockKey: evalLockKey,
        startedAt,
        completedAt: startedAt,
        heartbeatAt: startedAt,
      },
    });

    const beforeHb = await getWorkerHealth("EVALUATION", opType);
    expect(beforeHb.healthStatus).toBe("DEGRADED");

    const updated = await recordEvaluationIdleHeartbeat("SECURITY_GUARDING");
    expect(updated).toBe(true);

    const afterHb = await getWorkerHealth("EVALUATION", opType);
    expect(afterHb.healthStatus).toBe("HEALTHY");
    expect(afterHb.heartbeatAgeSeconds).toBeLessThan(10);
  });

  it("2. recordEvaluationIdleHeartbeat never masks a FAILED job as HEALTHY", async () => {
    await prisma.secFacWorkerJob.create({
      data: {
        jobType: "EVALUATION_CYCLE",
        operationType: opType,
        status: "FAILED",
        lockKey: evalLockKey,
        startedAt: new Date(),
        completedAt: new Date(),
        heartbeatAt: new Date(),
        errorSummary: "Simulated DB failure",
      },
    });

    const updated = await recordEvaluationIdleHeartbeat("SECURITY_GUARDING");
    expect(updated).toBe(false);

    const health = await getWorkerHealth("EVALUATION", opType);
    expect(health.healthStatus).toBe("DEGRADED");
    expect(health.healthReason).toContain("Simulated DB failure");
  });

  it("3. createMonitoringAlertIfBreached deduplicates ongoing open alerts without creating duplicates", async () => {
    const a1 = await createMonitoringAlertIfBreached(
      "WORKER_EVAL_UNHEALTHY",
      "HIGH",
      "Evaluation Worker DEGRADED",
      "Heartbeat age (150s) exceeds warning threshold (120s).",
      opType
    );

    const a2 = await createMonitoringAlertIfBreached(
      "WORKER_EVAL_UNHEALTHY",
      "CRITICAL",
      "Evaluation Worker UNHEALTHY",
      "Heartbeat age (310s) exceeds critical threshold (300s).",
      opType
    );

    expect(a2.id).toBe(a1.id);
    expect(a2.severity).toBe("CRITICAL");

    const openCount = await prisma.secFacOperationalAlert.count({
      where: {
        operationType: opType,
        alertCode: "WORKER_EVAL_UNHEALTHY",
        status: { in: ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"] },
      },
    });
    expect(openCount).toBe(1);
  });

  it("4. Historical WORKER_EVAL_UNHEALTHY alerts remain preserved on healthy cycles under default configuration", async () => {
    const openAlert = await createMonitoringAlertIfBreached(
      "WORKER_EVAL_UNHEALTHY",
      "HIGH",
      "Evaluation Worker DEGRADED",
      "Earlier degraded state",
      opType
    );
    expect(openAlert.status).toBe("OPEN");

    // Seed healthy EVALUATION and NOTIFICATION worker jobs
    const now = new Date();
    await prisma.secFacWorkerJob.createMany({
      data: [
        {
          jobType: "EVALUATION_CYCLE",
          operationType: opType,
          status: "COMPLETED",
          lockKey: evalLockKey,
          startedAt: now,
          completedAt: now,
          heartbeatAt: now,
        },
        {
          jobType: "NOTIFICATION_OUTBOX_CYCLE",
          operationType: opType,
          status: "COMPLETED",
          lockKey: notifLockKey,
          startedAt: now,
          completedAt: now,
          heartbeatAt: now,
        },
      ],
    });

    const cycleRes = await runMonitoringWorkerCycle(opType, "test-mon-worker");
    expect(cycleRes.evalWorkerStatus).toBe("HEALTHY");

    const preservedAlert = await prisma.secFacOperationalAlert.findUnique({
      where: { id: openAlert.id },
    });
    expect(preservedAlert).toBeTruthy();
    expect(preservedAlert?.status).toBe("OPEN");
    expect(preservedAlert?.resolvedAt).toBeNull();
  });

  it("5. Auto-recovery requires explicit opt-in and eligibility cutoff, never resolving historical or acknowledged alerts", async () => {
    const oldDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const cutoffDate = new Date(Date.now() - 60 * 1000);
    const recentDate = new Date();

    const historicalAlert = await prisma.secFacOperationalAlert.create({
      data: {
        operationType: opType,
        alertCode: "WORKER_EVAL_UNHEALTHY",
        sourceType: "MONITORING_ENGINE",
        severity: "HIGH",
        title: "Historical Alert",
        message: "Pre-cutoff historical alert",
        businessDate: oldDate,
        deduplicationKey: `${opType}:WORKER_EVAL_UNHEALTHY:HIST:${Date.now()}`,
        firstDetectedAt: oldDate,
        lastDetectedAt: oldDate,
        status: "OPEN",
      },
    });

    const ackAlert = await prisma.secFacOperationalAlert.create({
      data: {
        operationType: opType,
        alertCode: "WORKER_EVAL_UNHEALTHY",
        sourceType: "MONITORING_ENGINE",
        severity: "HIGH",
        title: "Acknowledged Alert",
        message: "Operator-owned alert",
        businessDate: recentDate,
        deduplicationKey: `${opType}:WORKER_EVAL_UNHEALTHY:ACK:${Date.now()}`,
        firstDetectedAt: recentDate,
        lastDetectedAt: recentDate,
        status: "ACKNOWLEDGED",
      },
    });

    const eligibleAlert = await prisma.secFacOperationalAlert.create({
      data: {
        operationType: opType,
        alertCode: "WORKER_EVAL_UNHEALTHY",
        sourceType: "MONITORING_ENGINE",
        severity: "HIGH",
        title: "Eligible New Alert",
        message: "Post-cutoff open alert",
        businessDate: recentDate,
        deduplicationKey: `${opType}:WORKER_EVAL_UNHEALTHY:NEW:${Date.now()}`,
        firstDetectedAt: recentDate,
        lastDetectedAt: recentDate,
        status: "OPEN",
      },
    });

    try {
      // Flag enabled WITHOUT cutoff fails closed
      process.env.SECFAC_MONITORING_AUTO_RESOLVE_ENABLED = "true";
      delete process.env.SECFAC_MONITORING_AUTO_RESOLVE_MIN_FIRST_DETECTED_AT;
      const noCutoffRes = await resolveMonitoringAlertsOnRecovery("WORKER_EVAL_UNHEALTHY", opType);
      expect(noCutoffRes.count).toBe(0);

      // Flag + cutoff resolves ONLY eligibleAlert
      process.env.SECFAC_MONITORING_AUTO_RESOLVE_MIN_FIRST_DETECTED_AT = cutoffDate.toISOString();
      const res = await resolveMonitoringAlertsOnRecovery("WORKER_EVAL_UNHEALTHY", opType);
      expect(res.count).toBeGreaterThanOrEqual(1);

      const [histAfter, ackAfter, eligAfter] = await Promise.all([
        prisma.secFacOperationalAlert.findUnique({ where: { id: historicalAlert.id } }),
        prisma.secFacOperationalAlert.findUnique({ where: { id: ackAlert.id } }),
        prisma.secFacOperationalAlert.findUnique({ where: { id: eligibleAlert.id } }),
      ]);
      expect(histAfter?.status).toBe("OPEN");
      expect(ackAfter?.status).toBe("ACKNOWLEDGED");
      expect(eligAfter?.status).toBe("RESOLVED");
      expect(eligAfter?.resolutionNote).toContain("HEALTHY");
    } finally {
      delete process.env.SECFAC_MONITORING_AUTO_RESOLVE_ENABLED;
      delete process.env.SECFAC_MONITORING_AUTO_RESOLVE_MIN_FIRST_DETECTED_AT;
      await prisma.secFacOperationalAlert.deleteMany({
        where: { id: { in: [historicalAlert.id, ackAlert.id, eligibleAlert.id] } },
      });
    }
  });

  it("6. resolveMonitoringAlertsOnRecovery is idempotent when disabled or no eligible alerts remain", async () => {
    const res = await resolveMonitoringAlertsOnRecovery("WORKER_EVAL_UNHEALTHY", opType);
    expect(res.count).toBe(0);
  });
});
