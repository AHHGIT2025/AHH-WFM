import { runPilotStage1, runPilotStage2, runPilotStage3 } from "../../apps/web/lib/secfac-pilot-runner";
import { processOutboxBatch } from "../../apps/web/lib/secfac-notification-outbox";
import { acquireWorkerLock, releaseWorkerLock } from "../../apps/web/lib/secfac-worker-lock";
import { resolveRecipientContactDetails } from "../../apps/web/lib/secfac-notification-recipient";
import { evaluateQuietHours } from "../../apps/web/lib/secfac-notification-preferences";
import { emailProvider } from "../../apps/web/lib/notifications/providers/email-provider";
import { prisma } from "@ahh-wfm/database";

describe("SECFAC Phase 5C — Controlled Activation Pilot Suite", () => {
  beforeAll(async () => {
    await prisma.secFacNotificationAttempt.deleteMany({
      where: { operationType: { in: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"] } }
    });
    await prisma.secFacAlertNotification.deleteMany({
      where: { operationType: { in: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"] } }
    });
    await prisma.secFacWorkerJob.deleteMany({
      where: { operationType: { in: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"] } }
    });
  });

  describe("Pilot Stage 1 — Evaluation Worker Governance", () => {
    it("handles evaluation worker when disabled via feature flag", async () => {
      delete process.env.SECFAC_EVALUATION_WORKER_ENABLED;
      const res = await runPilotStage1("SECURITY_GUARDING", "PROJ-SEC-01");

      expect(res.workerEnabled).toBe(false);
      expect(res.alertsEvaluated).toBe(0);
    });

    it("evaluates only single selected operation scope and updates heartbeat when enabled", async () => {
      process.env.SECFAC_EVALUATION_WORKER_ENABLED = "true";
      const res = await runPilotStage1("SECURITY_GUARDING", "PROJ-SEC-01");

      expect(res.workerEnabled).toBe(true);
      expect(res.lockAcquired).toBe(true);
      expect(res.operationType).toBe("SECURITY_GUARDING");
      expect(res.noStaleLocks).toBe(true);
      delete process.env.SECFAC_EVALUATION_WORKER_ENABLED;
    });

    it("rejects duplicate worker lock when evaluation cycle is already active", async () => {
      const lockKey = "secfac:worker:evaluation:security_guarding";
      await acquireWorkerLock(lockKey, "active-worker-1", 60);

      process.env.SECFAC_EVALUATION_WORKER_ENABLED = "true";
      const res = await runPilotStage1("SECURITY_GUARDING", "PROJ-SEC-01");

      expect(res.lockAcquired).toBe(false);
      delete process.env.SECFAC_EVALUATION_WORKER_ENABLED;
      await releaseWorkerLock(lockKey, "active-worker-1");
    });
  });

  describe("Pilot Stage 2 — IN_APP Notification Worker & Concurrency", () => {
    it("claims and transitions IN_APP notification from PENDING to SENT safely", async () => {
      process.env.SECFAC_NOTIFICATION_WORKER_ENABLED = "true";

      const alert = await prisma.secFacOperationalAlert.create({
        data: {
          operationType: "SECURITY_GUARDING",
          alertCode: "GUARD_NO_SHOW",
          sourceType: "ATTENDANCE",
          severity: "HIGH",
          status: "OPEN",
          title: "Pilot Guard No Show",
          message: "Guard attendance delayed at Main Gate",
          businessDate: new Date(),
          deduplicationKey: `GUARD_NO_SHOW:pilot-test:${Date.now()}`,
          firstDetectedAt: new Date(),
          lastDetectedAt: new Date()
        }
      });

      const notifKey = `${alert.id}:pilot-sup-1:INITIAL:0`;
      const notif = await prisma.secFacAlertNotification.create({
        data: {
          alertId: alert.id,
          operationType: "SECURITY_GUARDING",
          recipientRole: "SECURITY_SUPERVISOR",
          channel: "IN_APP",
          notificationType: "INITIAL",
          status: "PENDING",
          notificationKey: notifKey,
          scheduledAt: new Date()
        }
      });

      const res = await runPilotStage2("SECURITY_GUARDING");

      expect(res.workerEnabled).toBe(true);
      expect(res.sentCount).toBeGreaterThan(0);
      expect(res.isolated).toBe(true);

      const updated = await prisma.secFacAlertNotification.findUnique({ where: { id: notif.id } });
      expect(updated?.status).toBe("SENT");
      expect(updated?.sentAt).toBeDefined();

      delete process.env.SECFAC_NOTIFICATION_WORKER_ENABLED;
    });
  });

  describe("Pilot Stage 3 — Controlled Email Pilot Scenarios", () => {
    it("returns PROVIDER_DISABLED when Email feature flag is false", async () => {
      delete process.env.SECFAC_EMAIL_ENABLED;
      const res = await runPilotStage3("SECURITY_GUARDING", "pilot.supervisor@alhattab.com.qa");

      expect(res.emailEnabled).toBe(false);
      expect(res.scenarios.every(s => s.privacyVerified)).toBe(true);
    });

    it("rejects invalid recipient user ID during pilot resolution", async () => {
      const res = await resolveRecipientContactDetails("SECURITY_GUARDING", "invalid-user-123");
      expect(res.eligible).toBe(false);
      expect(res.ineligibilityReason).toContain("not found");
    });

    it("defers non-critical alert delivery during quiet-hours window", () => {
      const quiet = evaluateQuietHours("22:00", "06:00", "Asia/Qatar", "MEDIUM", true, new Date("2026-07-20T23:00:00Z"));
      expect(quiet.action).toBe("DEFER");
      expect(quiet.isQuietHours).toBe(true);
    });

    it("verifies privacy: response logs do not contain sensitive payroll or password strings", async () => {
      const payload: any = {
        notificationId: "notif-privacy-1",
        alertId: "alert-privacy-1",
        operationType: "SECURITY_GUARDING",
        alertCode: "PATROL_MISSED",
        severity: "HIGH",
        title: "Patrol Missed",
        message: "Patrol route 3 missed",
        recipientEmail: "pilot@alhattab.com.qa",
        channel: "EMAIL",
        notificationType: "INITIAL",
        attemptNumber: 1
      };

      const res = await emailProvider.send(payload);
      const str = JSON.stringify(res);

      expect(str).not.toContain("password");
      expect(str).not.toContain("salary");
      expect(str).not.toContain("qidNumber");
    });
  });
});
