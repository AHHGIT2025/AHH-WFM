import { runControlledEvaluationCycle, runControlledEvaluationPilot } from "../../apps/web/lib/secfac-eval-activation";
import { acquireWorkerLock, releaseWorkerLock } from "../../apps/web/lib/secfac-worker-lock";
import { prisma } from "@ahh-wfm/database";

describe("SECFAC Phase 5C — Controlled Evaluation Worker Activation Suite", () => {
  beforeAll(async () => {
    await prisma.secFacWorkerJob.deleteMany({
      where: { operationType: { in: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"] } }
    });
    await prisma.secFacWorkerLock.deleteMany({
      where: { lockKey: { contains: "evaluation" } }
    });
    // Remove any FM test-fixture alerts that preceding suites may have left behind.
    // Identified by alertCode=TASK_OVERDUE + sourceType=TASK — a combination exclusive to
    // secfac-alerts-rollout.spec.ts fixtures; never present in live Phase 5D pilot records.
    // Child rows are deleted before the parent to satisfy foreign-key constraints.
    const residualFmFixtures = await prisma.secFacOperationalAlert.findMany({
      where: {
        operationType: "FACILITY_MANAGEMENT",
        alertCode: "TASK_OVERDUE",
        sourceType: "TASK"
      },
      select: { id: true }
    });
    if (residualFmFixtures.length > 0) {
      const ids = residualFmFixtures.map((a: { id: string }) => a.id);
      await prisma.secFacAlertEvent.deleteMany({ where: { alertId: { in: ids } } });
      await prisma.secFacAlertNotification.deleteMany({ where: { alertId: { in: ids } } });
      await prisma.secFacOperationalAlert.deleteMany({ where: { id: { in: ids } } });
    }
  });

  describe("Evaluation Worker Execution & Locking", () => {
    it("executes evaluation cycle for single operation scope (SECURITY_GUARDING)", async () => {
      const cycle = await runControlledEvaluationCycle(1, "SECURITY_GUARDING", "PROJ-SEC-01");

      expect(cycle.operationType).toBe("SECURITY_GUARDING");
      expect(cycle.lockAcquired).toBe(true);
      expect(cycle.heartbeatUpdated).toBe(true);
      expect(cycle.lockReleased).toBe(true);
      expect(cycle.scopeViolations).toBe(0);
    });

    it("rejects concurrent evaluation worker lock acquisition", async () => {
      const lockKey = "secfac:worker:evaluation:security_guarding";
      const activeLock = await acquireWorkerLock(lockKey, "existing-worker-pid-100", 60);
      expect(activeLock.acquired).toBe(true);

      const cycle = await runControlledEvaluationCycle(2, "SECURITY_GUARDING", "PROJ-SEC-01");
      expect(cycle.lockAcquired).toBe(false);

      await releaseWorkerLock(lockKey, "existing-worker-pid-100");
    });

    it("recovers expired stale lock safely during evaluation cycle startup", async () => {
      const lockKey = "secfac:worker:evaluation:security_guarding";
      const staleDate = new Date(Date.now() - 120000); // 2 minutes in the past

      await prisma.secFacWorkerLock.create({
        data: {
          lockKey,
          ownerId: "dead-worker-pid-999",
          acquiredAt: staleDate,
          expiresAt: staleDate,
          heartbeatAt: staleDate
        }
      });

      const cycle = await runControlledEvaluationCycle(3, "SECURITY_GUARDING", "PROJ-SEC-01");
      expect(cycle.lockAcquired).toBe(true);
      expect(cycle.lockReleased).toBe(true);
    });
  });

  describe("Deduplication & Scope Isolation Governance", () => {
    it("executes multi-cycle pilot without duplicating alerts or violating scope isolation", async () => {
      process.env.SECFAC_EVALUATION_WORKER_ENABLED = "true";
      delete process.env.SECFAC_NOTIFICATION_WORKER_ENABLED;
      delete process.env.SECFAC_EMAIL_ENABLED;

      await prisma.secFacAlertNotification.deleteMany({
        where: { operationType: "SECURITY_GUARDING" }
      });
      const report = await runControlledEvaluationPilot(3, "SECURITY_GUARDING", "PROJ-SEC-01");

      expect(report.operationType).toBe("SECURITY_GUARDING");
      expect(report.cycles.length).toBe(3);
      expect(report.scopeIsolationVerified).toBe(true);
      expect(report.externalDeliveryCount).toBe(0);

      // Verify no notification worker processed any queued notifications
      const sentNotifs = await prisma.secFacAlertNotification.count({
        where: { operationType: "SECURITY_GUARDING", status: "SENT", claimedBy: { contains: "notification-worker" } }
      });
      expect(sentNotifs).toBe(0);

      delete process.env.SECFAC_EVALUATION_WORKER_ENABLED;
    });
  });
});
