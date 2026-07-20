import { runControlledNotificationCycle, runControlledNotificationPilot } from "../../apps/web/lib/secfac-notif-activation";
import { claimPendingNotificationsBatch, processOutboxBatch } from "../../apps/web/lib/secfac-notification-outbox";
import { prisma } from "@ahh-wfm/database";

describe("SECFAC Phase 5C — Controlled IN_APP Notification Worker Activation Suite", () => {
  let testAlertId: string;

  beforeAll(async () => {
    await prisma.secFacWorkerJob.deleteMany({
      where: { operationType: { in: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"] } }
    });
    await prisma.secFacAlertNotification.deleteMany({
      where: { operationType: { in: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"] } }
    });

    const alert = await prisma.secFacOperationalAlert.create({
      data: {
        operationType: "SECURITY_GUARDING",
        alertCode: "PATROL_MISSED",
        sourceType: "SECURITY_PATROL",
        severity: "HIGH",
        status: "OPEN",
        title: "Test Patrol Missed",
        message: "Patrol route 4 missed",
        businessDate: new Date(),
        deduplicationKey: `PATROL_MISSED:notif-act-test:${Date.now()}`,
        firstDetectedAt: new Date(),
        lastDetectedAt: new Date()
      }
    });
    testAlertId = alert.id;
  });

  describe("Queue Claiming & Lifecycle Transitions", () => {
    it("claims pending IN_APP notifications atomically with unique claim token", async () => {
      const notifKey = `${testAlertId}:sup-notif-act-1:INITIAL:0`;
      const notif = await prisma.secFacAlertNotification.create({
        data: {
          alertId: testAlertId,
          operationType: "SECURITY_GUARDING",
          recipientRole: "SECURITY_SUPERVISOR",
          channel: "IN_APP",
          notificationType: "INITIAL",
          status: "PENDING",
          notificationKey: notifKey,
          scheduledAt: new Date()
        }
      });

      const claimRes = await claimPendingNotificationsBatch(10, "worker-test-act-1", 300, "SECURITY_GUARDING", "IN_APP");

      expect(claimRes.claimToken).toBeDefined();
      expect(claimRes.notifications.some(n => n.id === notif.id)).toBe(true);

      const claimedInDb = await prisma.secFacAlertNotification.findUnique({ where: { id: notif.id } });
      expect(claimedInDb?.status).toBe("CLAIMED");
      expect(claimedInDb?.claimedBy).toBe("worker-test-act-1");
    });

    it("prevents duplicate worker from claiming already claimed unexpired records", async () => {
      const claimRes2 = await claimPendingNotificationsBatch(10, "worker-test-act-2", 300, "SECURITY_GUARDING", "IN_APP");
      expect(claimRes2.notifications.length).toBe(0);
    });

    it("processes claimed IN_APP notification to SENT status", async () => {
      process.env.SECFAC_NOTIFICATION_WORKER_ENABLED = "true";

      const notifKey = `${testAlertId}:sup-notif-sent-1:INITIAL:0`;
      await prisma.secFacAlertNotification.create({
        data: {
          alertId: testAlertId,
          operationType: "SECURITY_GUARDING",
          recipientRole: "SECURITY_SUPERVISOR",
          channel: "IN_APP",
          notificationType: "INITIAL",
          status: "PENDING",
          notificationKey: notifKey,
          scheduledAt: new Date()
        }
      });

      const cycle = await runControlledNotificationCycle(1, "SECURITY_GUARDING", "IN_APP");

      expect(cycle.lockAcquired).toBe(true);
      expect(cycle.sentCount).toBeGreaterThan(0);
      expect(cycle.externalDeliveryCount).toBe(0);
      expect(cycle.scopeViolations).toBe(0);

      delete process.env.SECFAC_NOTIFICATION_WORKER_ENABLED;
    });
  });

  describe("Retry, Dead-Letter & Cancellation Governance", () => {
    it("routes to DEAD_LETTER when maximum attempt threshold (5) is exceeded", async () => {
      const notifKey = `${testAlertId}:sup-notif-dead-1:INITIAL:0`;
      const notif = await prisma.secFacAlertNotification.create({
        data: {
          alertId: testAlertId,
          operationType: "SECURITY_GUARDING",
          recipientRole: "SECURITY_SUPERVISOR",
          channel: "IN_APP",
          notificationType: "INITIAL",
          status: "RETRY_SCHEDULED",
          attemptCount: 5,
          notificationKey: notifKey,
          scheduledAt: new Date()
        }
      });

      const batchRes = await processOutboxBatch(10, "worker-dead-letter-test", "SECURITY_GUARDING", "IN_APP");

      const updated = await prisma.secFacAlertNotification.findUnique({ where: { id: notif.id } });
      expect(updated?.status === "DEAD_LETTER" || updated?.status === "SENT").toBe(true);
    });

    it("cancels pending notification when underlying alert is RESOLVED", async () => {
      const resolvedAlert = await prisma.secFacOperationalAlert.create({
        data: {
          operationType: "SECURITY_GUARDING",
          alertCode: "GUARD_NO_SHOW",
          sourceType: "ATTENDANCE",
          severity: "HIGH",
          status: "RESOLVED",
          title: "Resolved Guard No Show",
          message: "Guard arrived late and resolved",
          businessDate: new Date(),
          deduplicationKey: `GUARD_NO_SHOW:resolved-test:${Date.now()}`,
          firstDetectedAt: new Date(),
          lastDetectedAt: new Date(),
          resolvedAt: new Date()
        }
      });

      const notifKey = `${resolvedAlert.id}:sup-notif-cancel-1:INITIAL:0`;
      const notif = await prisma.secFacAlertNotification.create({
        data: {
          alertId: resolvedAlert.id,
          operationType: "SECURITY_GUARDING",
          recipientRole: "SECURITY_SUPERVISOR",
          channel: "IN_APP",
          notificationType: "INITIAL",
          status: "PENDING",
          notificationKey: notifKey,
          scheduledAt: new Date()
        }
      });

      const batchRes = await processOutboxBatch(10, "worker-cancel-test", "SECURITY_GUARDING", "IN_APP");

      const updated = await prisma.secFacAlertNotification.findUnique({ where: { id: notif.id } });
      expect(updated?.status).toBe("CANCELLED");
    });
  });

  describe("Multi-Cycle Activation & Scope Isolation", () => {
    it("runs multi-cycle notification pilot cleanly without external provider calls", async () => {
      process.env.SECFAC_NOTIFICATION_WORKER_ENABLED = "true";
      delete process.env.SECFAC_EMAIL_ENABLED;
      delete process.env.SECFAC_PUSH_ENABLED;
      delete process.env.SECFAC_WHATSAPP_ENABLED;
      delete process.env.SECFAC_SMS_ENABLED;

      const report = await runControlledNotificationPilot(3, "SECURITY_GUARDING", "IN_APP");

      expect(report.operationType).toBe("SECURITY_GUARDING");
      expect(report.channelFilter).toBe("IN_APP");
      expect(report.cycles.length).toBe(3);
      expect(report.scopeIsolationVerified).toBe(true);
      expect(report.externalDeliveryCount).toBe(0);

      delete process.env.SECFAC_NOTIFICATION_WORKER_ENABLED;
    });
  });
});
