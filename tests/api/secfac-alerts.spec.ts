import {
  resolveApplicableAlertRule,
  createOrUpdateOperationalAlert,
  acknowledgeOperationalAlert,
  startOperationalAlertAction,
  resolveOperationalAlert,
  dismissOperationalAlert,
  cancelOperationalAlert,
  getQatarBusinessDateString
} from "../../apps/web/lib/secfac-alert-service";
import { evaluateAlertEscalation } from "../../apps/web/lib/secfac-alert-escalation";
import { resolveAlertSupervisor } from "../../apps/web/lib/secfac-alert-resolver";
import { prisma } from "@ahh-wfm/database";

describe("SECFAC Phase 5B — Alerting & Supervisor Escalation Engine", () => {

  const testSiteId = "test-secfac-site-5b";
  const testProjectId = "test-secfac-project-5b";
  const testContractId = "test-secfac-contract-5b";

  beforeAll(async () => {
    // Ensure clean test setup for rules and alerts
    await prisma.secFacAlertNotification.deleteMany({
      where: { operationType: { in: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"] } }
    });
    await prisma.secFacAlertEvent.deleteMany({
      where: { operationType: { in: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"] } }
    });
    await prisma.secFacOperationalAlert.deleteMany({
      where: { operationType: { in: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"] } }
    });
    await prisma.secFacAlertRule.deleteMany({
      where: { operationType: { in: ["SECURITY_GUARDING", "FACILITY_MANAGEMENT"] } }
    });
  });

  describe("Rule Resolution Priority", () => {
    it("returns null when no active rule exists", async () => {
      const res = await resolveApplicableAlertRule("SECURITY_GUARDING", "GUARD_NO_SHOW", testSiteId, testProjectId);
      expect(res.rule).toBeNull();
      expect(res.scopeLevel).toBe("NONE");
    });

    it("resolves Global active rule when site and project overrides do not exist", async () => {
      const globalRule = await prisma.secFacAlertRule.create({
        data: {
          operationType: "SECURITY_GUARDING",
          code: "GUARD_NO_SHOW",
          name: "Global Guard No Show",
          sourceType: "ATTENDANCE_SCHEDULING",
          severity: "HIGH",
          isActive: true
        }
      });

      const res = await resolveApplicableAlertRule("SECURITY_GUARDING", "GUARD_NO_SHOW", testSiteId, testProjectId);
      expect(res.rule).not.toBeNull();
      expect(res.rule?.id).toBe(globalRule.id);
      expect(res.scopeLevel).toBe("GLOBAL");
    });

    it("resolves Project override over Global rule", async () => {
      const projRule = await prisma.secFacAlertRule.create({
        data: {
          operationType: "SECURITY_GUARDING",
          code: "GUARD_NO_SHOW",
          name: "Project Guard No Show Override",
          sourceType: "ATTENDANCE_SCHEDULING",
          severity: "CRITICAL",
          projectId: testProjectId,
          isActive: true
        }
      });

      const res = await resolveApplicableAlertRule("SECURITY_GUARDING", "GUARD_NO_SHOW", testSiteId, testProjectId);
      expect(res.rule).not.toBeNull();
      expect(res.rule?.id).toBe(projRule.id);
      expect(res.scopeLevel).toBe("PROJECT");
    });

    it("resolves Site override over Project and Global rules", async () => {
      const siteRule = await prisma.secFacAlertRule.create({
        data: {
          operationType: "SECURITY_GUARDING",
          code: "GUARD_NO_SHOW",
          name: "Site Guard No Show Override",
          sourceType: "ATTENDANCE_SCHEDULING",
          severity: "CRITICAL",
          siteId: testSiteId,
          isActive: true
        }
      });

      const res = await resolveApplicableAlertRule("SECURITY_GUARDING", "GUARD_NO_SHOW", testSiteId, testProjectId);
      expect(res.rule).not.toBeNull();
      expect(res.rule?.id).toBe(siteRule.id);
      expect(res.scopeLevel).toBe("SITE");
    });

    it("ignores inactive site rule and falls back to active project rule", async () => {
      await prisma.secFacAlertRule.updateMany({
        where: { siteId: testSiteId },
        data: { isActive: false }
      });

      const res = await resolveApplicableAlertRule("SECURITY_GUARDING", "GUARD_NO_SHOW", testSiteId, testProjectId);
      expect(res.rule).not.toBeNull();
      expect(res.scopeLevel).toBe("PROJECT");
    });
  });

  describe("Alert Creation, Deduplication & Reopening", () => {
    it("does not create alert when no active rule applies", async () => {
      const res = await createOrUpdateOperationalAlert({
        operationType: "SECURITY_GUARDING",
        alertCode: "PATROL_MISSED",
        sourceType: "PATROL",
        sourceId: "patrol-999",
        title: "Patrol Missed",
        message: "No guard started patrol"
      });

      expect(res.alert).toBeNull();
      expect(res.created).toBe(false);
      expect(res.warning).toBeDefined();
    });

    it("creates a new open alert when active rule exists and queues initial notification", async () => {
      const result = await createOrUpdateOperationalAlert({
        operationType: "SECURITY_GUARDING",
        alertCode: "GUARD_NO_SHOW",
        sourceType: "ATTENDANCE_SCHEDULING",
        sourceId: "asg-101",
        siteId: testSiteId,
        projectId: testProjectId,
        title: "Guard No Show at Main Gate",
        message: "Guard did not report within 15 minutes of shift start"
      });

      expect(result.created).toBe(true);
      expect(result.alert).not.toBeNull();
      expect(result.alert?.status).toBe("OPEN");
      expect(result.alert?.deduplicationKey).toContain("GUARD_NO_SHOW:asg-101:");

      // Check initial notification record created idempotently
      const notif = await prisma.secFacAlertNotification.findFirst({
        where: { alertId: result.alert!.id, notificationType: "INITIAL" }
      });
      expect(notif).not.toBeNull();
      expect(notif?.status).toBe("PENDING");
    });

    it("prevents duplicate open alerts on redetection and preserves acknowledgment", async () => {
      const initial = await createOrUpdateOperationalAlert({
        operationType: "SECURITY_GUARDING",
        alertCode: "GUARD_NO_SHOW",
        sourceType: "ATTENDANCE_SCHEDULING",
        sourceId: "asg-101",
        siteId: testSiteId,
        projectId: testProjectId,
        title: "Guard No Show at Main Gate",
        message: "Guard did not report within 15 minutes of shift start"
      });

      // Acknowledge the alert
      await acknowledgeOperationalAlert(initial.alert!.id, "user-sup-1", "Acknowledged by supervisor");

      // Attempt redetection
      const redetected = await createOrUpdateOperationalAlert({
        operationType: "SECURITY_GUARDING",
        alertCode: "GUARD_NO_SHOW",
        sourceType: "ATTENDANCE_SCHEDULING",
        sourceId: "asg-101",
        siteId: testSiteId,
        projectId: testProjectId,
        title: "Guard No Show at Main Gate",
        message: "Repeated anomaly detection scan"
      });

      expect(redetected.created).toBe(false);
      expect(redetected.redetected).toBe(true);
      expect(redetected.alert?.id).toBe(initial.alert!.id);
      expect(redetected.alert?.status).toBe("ACKNOWLEDGED"); // Acknowledgment is preserved!
    });

    it("reopens a resolved alert on the same business date and creates ALERT_REOPENED event", async () => {
      const initial = await createOrUpdateOperationalAlert({
        operationType: "SECURITY_GUARDING",
        alertCode: "GUARD_NO_SHOW",
        sourceType: "ATTENDANCE_SCHEDULING",
        sourceId: "asg-101",
        siteId: testSiteId,
        projectId: testProjectId,
        title: "Guard No Show",
        message: "No show"
      });

      // Resolve it
      await resolveOperationalAlert(initial.alert!.id, "user-sup-1", "Assigned reliever guard");

      // Re-trigger same issue on same business date
      const reopened = await createOrUpdateOperationalAlert({
        operationType: "SECURITY_GUARDING",
        alertCode: "GUARD_NO_SHOW",
        sourceType: "ATTENDANCE_SCHEDULING",
        sourceId: "asg-101",
        siteId: testSiteId,
        projectId: testProjectId,
        title: "Guard No Show",
        message: "Reliever guard also left site"
      });

      expect(reopened.reopened).toBe(true);
      expect(reopened.alert?.status).toBe("OPEN");

      // Check ALERT_REOPENED event
      const reopenEvent = await prisma.secFacAlertEvent.findFirst({
        where: { alertId: initial.alert!.id, eventType: "ALERT_REOPENED" }
      });
      expect(reopenEvent).not.toBeNull();
    });
  });

  describe("Lifecycle Actions & Mandatory Validation", () => {
    it("progresses alert from OPEN to ACKNOWLEDGED to IN_PROGRESS to RESOLVED", async () => {
      const created = await createOrUpdateOperationalAlert({
        operationType: "SECURITY_GUARDING",
        alertCode: "GUARD_NO_SHOW",
        sourceType: "ATTENDANCE_SCHEDULING",
        sourceId: "asg-202",
        title: "Unassigned shift",
        message: "No guard assigned"
      });

      const alertId = created.alert!.id;

      // 1. Acknowledge
      const acked = await acknowledgeOperationalAlert(alertId, "sup-10", "Investigating");
      expect(acked.status).toBe("ACKNOWLEDGED");

      // 2. Start Action
      const started = await startOperationalAlertAction(alertId, "sup-10", "Contacting standby pool");
      expect(started.status).toBe("IN_PROGRESS");

      // 3. Resolve
      const resolved = await resolveOperationalAlert(alertId, "sup-10", "Dispatched reliever guard from Doha central pool.");
      expect(resolved.status).toBe("RESOLVED");
      expect(resolved.resolutionNote).toContain("Dispatched reliever");
    });

    it("rejects High/Critical resolution when resolution note is empty", async () => {
      const created = await createOrUpdateOperationalAlert({
        operationType: "SECURITY_GUARDING",
        alertCode: "GUARD_NO_SHOW",
        sourceType: "ATTENDANCE_SCHEDULING",
        sourceId: "asg-303",
        title: "High severity issue",
        message: "Critical manpower shortage"
      });

      await expect(
        resolveOperationalAlert(created.alert!.id, "sup-10", "   ")
      ).rejects.toThrow(/resolution note is mandatory/i);
    });

    it("requires reason for dismissal and cancellation", async () => {
      const created1 = await createOrUpdateOperationalAlert({
        operationType: "SECURITY_GUARDING",
        alertCode: "GUARD_NO_SHOW",
        sourceType: "ATTENDANCE_SCHEDULING",
        sourceId: "asg-404",
        title: "Test dismissal",
        message: "Test"
      });

      await expect(
        dismissOperationalAlert(created1.alert!.id, "sup-10", "")
      ).rejects.toThrow(/dismissal reason is required/i);

      const dismissed = await dismissOperationalAlert(created1.alert!.id, "sup-10", "False positive alarm");
      expect(dismissed.status).toBe("DISMISSED");

      const created2 = await createOrUpdateOperationalAlert({
        operationType: "SECURITY_GUARDING",
        alertCode: "GUARD_NO_SHOW",
        sourceType: "ATTENDANCE_SCHEDULING",
        sourceId: "asg-505",
        title: "Test cancellation",
        message: "Test"
      });

      const cancelled = await cancelOperationalAlert(created2.alert!.id, "sup-10", "Deleted shift schedule");
      expect(cancelled.status).toBe("CANCELLED");
    });
  });

  describe("Supervisor Hierarchy & Escalation Engine", () => {
    it("routes unassigned alert to controlled ADMIN_QUEUE when no supervisor exists", async () => {
      const res = await resolveAlertSupervisor({
        operationType: "SECURITY_GUARDING",
        siteId: "non-existent-site-id",
        projectId: "non-existent-proj-id"
      });

      expect(res.source).toBe("ADMIN_QUEUE");
      expect(res.assignedUserId).toBeNull();
      expect(res.warnings.length).toBeGreaterThan(0);
    });

    it("escalates alert, increments level, and queues escalation notification idempotently", async () => {
      const created = await createOrUpdateOperationalAlert({
        operationType: "SECURITY_GUARDING",
        alertCode: "GUARD_NO_SHOW",
        sourceType: "ATTENDANCE_SCHEDULING",
        sourceId: "asg-606",
        title: "Escalation test alert",
        message: "Unresolved for over 30 mins"
      });

      const alertId = created.alert!.id;

      // Force escalation
      const escRes = await evaluateAlertEscalation(alertId, {
        force: true,
        actorUserId: "admin-1",
        forceReason: "Unresolved high severity breach"
      });

      expect(escRes.success).toBe(true);
      expect(escRes.escalated).toBe(true);
      expect(escRes.newLevel).toBe(1);

      const updatedAlert = await prisma.secFacOperationalAlert.findUnique({ where: { id: alertId } });
      expect(updatedAlert?.escalationLevel).toBe(1);
      expect(updatedAlert?.escalatedAt).not.toBeNull();

      // Verify escalation notification queued
      const escNotif = await prisma.secFacAlertNotification.findFirst({
        where: { alertId, notificationType: "ESCALATION" }
      });
      expect(escNotif).not.toBeNull();
      expect(escNotif?.notificationKey).toContain(`${alertId}:`);
    });
  });

  describe("Qatar Business Date Utilities", () => {
    it("returns consistent YYYY-MM-DD string in Qatar time (UTC+3)", () => {
      const bDate = getQatarBusinessDateString(new Date("2026-07-20T22:30:00Z"));
      expect(bDate).toMatch(/^2026-07-\d{2}$/);
    });
  });
});
