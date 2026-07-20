import { processOutboxBatch, claimPendingNotificationsBatch, manualRetryNotification } from "../../apps/web/lib/secfac-notification-outbox";
import { resolveNotificationPreferences, evaluateQuietHours } from "../../apps/web/lib/secfac-notification-preferences";
import { resolveRecipientContactDetails } from "../../apps/web/lib/secfac-notification-recipient";
import { emailProvider } from "../../apps/web/lib/notifications/providers/email-provider";
import { pushProvider } from "../../apps/web/lib/notifications/providers/push-provider";
import { whatsappProvider } from "../../apps/web/lib/notifications/providers/whatsapp-provider";
import { smsProvider } from "../../apps/web/lib/notifications/providers/sms-provider";
import { prisma } from "@ahh-wfm/database";

describe("SECFAC Phase 5C — Outbox Processing, Preferences & Channel Adapters", () => {
  beforeAll(async () => {
    await prisma.secFacNotificationAttempt.deleteMany({
      where: { operationType: { in: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"] } }
    });
    await prisma.secFacAlertNotification.deleteMany({
      where: { operationType: { in: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"] } }
    });
    await prisma.secFacNotificationPreference.deleteMany({
      where: { operationType: { in: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"] } }
    });
    await prisma.secFacChannelConfiguration.deleteMany({
      where: { operationType: { in: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"] } }
    });
    await prisma.secFacOperationalAlert.deleteMany({
      where: { operationType: { in: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"] } }
    });
  });

  describe("Preference Hierarchy & Quiet Hours", () => {
    it("resolves default fallback preference when no custom preference exists", async () => {
      const pref = await resolveNotificationPreferences("SECURITY_GUARDING", "user-1", "SECURITY_SUPERVISOR", "GUARD_NO_SHOW");
      expect(pref.inAppEnabled).toBe(true);
      expect(pref.emailEnabled).toBe(false);
      expect(pref.resolutionSource).toBe("FALLBACK");
    });

    it("evaluates quiet hours and defers non-critical alerts during overnight window", () => {
      const res = evaluateQuietHours("22:00", "06:00", "Asia/Qatar", "MEDIUM", true, new Date("2026-07-20T23:30:00Z"));
      expect(res.isQuietHours).toBe(true);
      expect(res.action).toBe("DEFER");
      expect(res.deferredUntil).toBeDefined();
    });

    it("bypasses quiet hours for critical alerts when critical override is enabled", () => {
      const res = evaluateQuietHours("22:00", "06:00", "Asia/Qatar", "CRITICAL", true, new Date("2026-07-20T23:30:00Z"));
      expect(res.isQuietHours).toBe(true);
      expect(res.action).toBe("DELIVER");
    });

    it("suppresses critical alerts during quiet hours when critical override is disabled", () => {
      const res = evaluateQuietHours("22:00", "06:00", "Asia/Qatar", "CRITICAL", false, new Date("2026-07-20T23:30:00Z"));
      expect(res.isQuietHours).toBe(true);
      expect(res.action).toBe("SUPPRESS");
    });
  });

  describe("Recipient Contact Resolution & Scope Isolation", () => {
    it("rejects non-existent recipient user", async () => {
      const res = await resolveRecipientContactDetails("SECURITY_GUARDING", "non-existent-user");
      expect(res.eligible).toBe(false);
      expect(res.ineligibilityReason).toContain("not found in master");
    });
  });

  describe("Provider Adapters & Feature Flags Safeguards", () => {
    const payload: any = {
      notificationId: "notif-test-1",
      alertId: "alert-test-1",
      operationType: "SECURITY_GUARDING",
      alertCode: "GUARD_NO_SHOW",
      severity: "HIGH",
      title: "Guard No Show",
      message: "Test message",
      recipientEmail: "guard@alhattab.com.qa",
      recipientPhone: "+97455000000",
      channel: "EMAIL",
      notificationType: "INITIAL",
      attemptNumber: 1
    };

    it("returns PROVIDER_DISABLED when Email feature flag is false", async () => {
      delete process.env.SECFAC_EMAIL_ENABLED;
      const res = await emailProvider.send(payload);
      expect(res.status).toBe("PROVIDER_DISABLED");
    });

    it("returns PROVIDER_DISABLED when Push feature flag is false", async () => {
      delete process.env.SECFAC_PUSH_ENABLED;
      const res = await pushProvider.send(payload);
      expect(res.status).toBe("PROVIDER_DISABLED");
    });

    it("returns PROVIDER_DISABLED when WhatsApp feature flag is false", async () => {
      delete process.env.SECFAC_WHATSAPP_ENABLED;
      const res = await whatsappProvider.send(payload);
      expect(res.status).toBe("PROVIDER_DISABLED");
    });

    it("returns PROVIDER_DISABLED when SMS feature flag is false", async () => {
      delete process.env.SECFAC_SMS_ENABLED;
      const res = await smsProvider.send(payload);
      expect(res.status).toBe("PROVIDER_DISABLED");
    });
  });

  describe("Atomic Queue Claiming & Concurrency", () => {
    it("claims pending notifications atomically and prevents duplicate worker claiming", async () => {
      const alert = await prisma.secFacOperationalAlert.create({
        data: {
          operationType: "SECURITY_GUARDING",
          alertCode: "GUARD_NO_SHOW",
          sourceType: "ATTENDANCE",
          severity: "HIGH",
          status: "OPEN",
          title: "Test Claim Alert",
          message: "Test claim message",
          businessDate: new Date(),
          deduplicationKey: `GUARD_NO_SHOW:test-claim:${Date.now()}`,
          firstDetectedAt: new Date(),
          lastDetectedAt: new Date()
        }
      });

      const notifKey = `${alert.id}:SUPERVISOR:INITIAL:1`;
      const notification = await prisma.secFacAlertNotification.create({
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

      // Worker 1 claims batch
      const claim1 = await claimPendingNotificationsBatch(10, "worker-1", 60);
      expect(claim1.notifications.some(n => n.id === notification.id)).toBe(true);

      // Worker 2 attempts to claim concurrently — candidate already claimed!
      const claim2 = await claimPendingNotificationsBatch(10, "worker-2", 60);
      expect(claim2.notifications.some(n => n.id === notification.id)).toBe(false);
    });
  });

  describe("Outbox Processing & Dead-Letter Queueing", () => {
    it("processes IN_APP notification and updates status to SENT", async () => {
      const res = await processOutboxBatch(10, "worker-test");
      expect(res.processedCount).toBeGreaterThan(0);
      expect(res.sentCount).toBeGreaterThan(0);
    });

    it("resets dead-letter notification to PENDING on manual retry", async () => {
      const alert = await prisma.secFacOperationalAlert.create({
        data: {
          operationType: "SECURITY_GUARDING",
          alertCode: "PATROL_MISSED",
          sourceType: "PATROL",
          severity: "HIGH",
          status: "OPEN",
          title: "Test Retry Alert",
          message: "Test message",
          businessDate: new Date(),
          deduplicationKey: `PATROL_MISSED:test-retry:${Date.now()}`,
          firstDetectedAt: new Date(),
          lastDetectedAt: new Date()
        }
      });

      const notif = await prisma.secFacAlertNotification.create({
        data: {
          alertId: alert.id,
          operationType: "SECURITY_GUARDING",
          channel: "EMAIL",
          notificationType: "INITIAL",
          status: "DEAD_LETTER",
          notificationKey: `test-retry-key-${Date.now()}`,
          attemptCount: 5,
          scheduledAt: new Date(),
          failureReason: "Max attempts exceeded"
        }
      });

      const retryRes = await manualRetryNotification(notif.id, "admin-user-1", "Testing manual retry");
      expect(retryRes.success).toBe(true);

      const updated = await prisma.secFacAlertNotification.findUnique({ where: { id: notif.id } });
      expect(updated?.status).toBe("PENDING");
    });
  });
});
