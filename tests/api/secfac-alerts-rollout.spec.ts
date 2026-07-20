import { calculateAlertSlaStatus, getDefaultSlaMinutes } from "../../apps/web/lib/secfac-alert-sla";
import { seedPilotAlertRules } from "../../apps/web/lib/secfac-alert-templates";
import { validatePilotReadiness, calculateAlertRuleHealth, validateRuleActivation } from "../../apps/web/lib/secfac-alert-rollout";
import { createOrUpdateOperationalAlert, listOperationalAlerts } from "../../apps/web/lib/secfac-alert-service";
import { prisma } from "@ahh-wfm/database";

describe("SECFAC Phase 5B — Rollout Hardening, SLA & Analytics Engine", () => {
  const testSiteId = "rollout-site-5b";
  const testProjectId = "rollout-proj-5b";

  beforeAll(async () => {
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

  describe("SLA Calculation Helper", () => {
    it("returns correct default SLA minutes by severity", () => {
      expect(getDefaultSlaMinutes("CRITICAL")).toEqual({ ackMinutes: 5, resMinutes: 60 });
      expect(getDefaultSlaMinutes("HIGH")).toEqual({ ackMinutes: 15, resMinutes: 120 });
      expect(getDefaultSlaMinutes("MEDIUM")).toEqual({ ackMinutes: 30, resMinutes: 240 });
      expect(getDefaultSlaMinutes("LOW")).toEqual({ ackMinutes: 60, resMinutes: 480 });
    });

    it("identifies active SLA breaches and stops overdue status when acknowledged/resolved", () => {
      const now = new Date();
      const past30Mins = new Date(now.getTime() - 30 * 60 * 1000);

      const alert: any = {
        id: "alert-sla-1",
        operationType: "SECURITY_GUARDING",
        severity: "HIGH", // Ack SLA: 15m, Res SLA: 120m
        status: "OPEN",
        firstDetectedAt: past30Mins,
        acknowledgedAt: null,
        resolvedAt: null
      };

      const slaBefore = calculateAlertSlaStatus(alert, null, now);
      expect(slaBefore.acknowledgementOverdue).toBe(true);
      expect(slaBefore.resolutionOverdue).toBe(false);
      expect(slaBefore.breachedSlaType).toBe("ACKNOWLEDGEMENT");

      // Once acknowledged, active acknowledgement overdue stops
      alert.status = "ACKNOWLEDGED";
      alert.acknowledgedAt = now;
      const slaAfterAck = calculateAlertSlaStatus(alert, null, now);
      expect(slaAfterAck.acknowledgementOverdue).toBe(false);

      // Once resolved, active resolution overdue stops
      alert.status = "RESOLVED";
      alert.resolvedAt = now;
      const slaAfterRes = calculateAlertSlaStatus(alert, null, now);
      expect(slaAfterRes.acknowledgementOverdue).toBe(false);
      expect(slaAfterRes.resolutionOverdue).toBe(false);
      expect(slaAfterRes.breachedSlaType).toBeNull();
    });
  });

  describe("Pilot Template Seeding & Inactive Default Safeguard", () => {
    it("seeds Security Guarding pilot templates with isActive = false by default", async () => {
      await prisma.secFacAlertRule.deleteMany({ where: { operationType: "SECURITY_GUARDING" } });
      const res = await seedPilotAlertRules("SECURITY_GUARDING");
      expect(res.seeded).toBeGreaterThan(0);

      const seededRules = await prisma.secFacAlertRule.findMany({
        where: { operationType: "SECURITY_GUARDING" }
      });

      expect(seededRules.length).toBe(res.seeded);
      for (const r of seededRules) {
        expect(r.isActive).toBe(false); // MANDATORY REQUIREMENT: INACTIVE BY DEFAULT!
      }
    });

    it("seeds Facility Management pilot templates with isActive = false by default", async () => {
      await prisma.secFacAlertRule.deleteMany({ where: { operationType: "FACILITY_MANAGEMENT" } });
      const res = await seedPilotAlertRules("FACILITY_MANAGEMENT");
      expect(res.seeded).toBeGreaterThan(0);

      const seededRules = await prisma.secFacAlertRule.findMany({
        where: { operationType: "FACILITY_MANAGEMENT" }
      });

      for (const r of seededRules) {
        expect(r.isActive).toBe(false);
      }
    });
  });

  describe("Pilot Readiness Checklist", () => {
    it("returns NOT_READY when no rules are active", async () => {
      await prisma.secFacAlertRule.updateMany({
        where: { operationType: "SECURITY_GUARDING" },
        data: { isActive: false }
      });
      const readiness = await validatePilotReadiness("SECURITY_GUARDING");
      expect(readiness.overallStatus).toBe("NOT_READY");
      const activeCheck = readiness.checks.find(c => c.id === "active_rules_exist");
      expect(activeCheck?.passed).toBe(false);
    });

    it("rejects activation of a rule with cross-operation roles", async () => {
      const invalidRule = await prisma.secFacAlertRule.create({
        data: {
          operationType: "SECURITY_GUARDING",
          code: "GUARD_NO_SHOW",
          name: "Invalid Cross Role Rule",
          sourceType: "ATTENDANCE",
          severity: "HIGH",
          isActive: false,
          targetRole: "FM_SUPERVISOR", // Invalid cross role!
          fallbackRole: "SECURITY_OPERATIONS_MANAGER"
        }
      });

      const val = await validateRuleActivation(invalidRule.id);
      expect(val.valid).toBe(false);
      expect(val.errors.some(e => e.includes("Facility Management roles"))).toBe(true);
    });
  });

  describe("Admin Queue Routing & Monitoring", () => {
    it("routes unassigned alert to ADMIN_QUEUE when no supervisor exists and supports assignmentSource filter", async () => {
      // Activate one global rule for testing
      const rule = await prisma.secFacAlertRule.findFirst({
        where: { operationType: "SECURITY_GUARDING", code: "GUARD_NO_SHOW" }
      });
      await prisma.secFacAlertRule.update({
        where: { id: rule!.id },
        data: { isActive: true }
      });

      const res = await createOrUpdateOperationalAlert({
        operationType: "SECURITY_GUARDING",
        alertCode: "GUARD_NO_SHOW",
        sourceType: "ATTENDANCE_SCHEDULING",
        sourceId: "asg-admin-queue-101",
        title: "Admin Queue Alert",
        message: "No supervisor mapped"
      });

      expect(res.alert?.assignmentSource).toBe("ADMIN_QUEUE");
      expect(res.alert?.assignedUserId).toBeNull();

      // Test filtering by assignmentSource
      const listRes = await listOperationalAlerts({
        operationType: "SECURITY_GUARDING",
        assignmentSource: "ADMIN_QUEUE"
      });

      expect(listRes.alerts.length).toBeGreaterThan(0);
      expect(listRes.alerts.some(a => a.id === res.alert!.id)).toBe(true);
    });
  });

  describe("Alert Fatigue Indicators", () => {
    it("flags rule as HIGH_NOISE when dismissal rate exceeds 40%", async () => {
      const rule = await prisma.secFacAlertRule.create({
        data: {
          operationType: "FACILITY_MANAGEMENT",
          code: "TASK_OVERDUE",
          name: "Noisy Task Overdue Rule",
          sourceType: "TASK",
          severity: "MEDIUM",
          isActive: true
        }
      });

      const bDate = new Date();
      // Create 10 alerts: 5 dismissed, 5 open
      for (let i = 0; i < 10; i++) {
        await prisma.secFacOperationalAlert.create({
          data: {
            operationType: "FACILITY_MANAGEMENT",
            ruleId: rule.id,
            alertCode: "TASK_OVERDUE",
            sourceType: "TASK",
            sourceId: `task-${i}`,
            severity: "MEDIUM",
            status: i < 5 ? "DISMISSED" : "OPEN",
            title: `Task ${i}`,
            message: `Task ${i} overdue`,
            businessDate: bDate,
            deduplicationKey: `TASK_OVERDUE:task-${i}:${bDate.toISOString()}`,
            firstDetectedAt: bDate,
            lastDetectedAt: bDate,
            dismissedAt: i < 5 ? bDate : null,
            dismissalReason: i < 5 ? "Routine noise" : null
          }
        });
      }

      const health = await calculateAlertRuleHealth(rule.id, 30);
      expect(health.dismissalRate).toBe(50);
      expect(health.health).toBe("HIGH_NOISE");
      expect(health.warnings.some(w => w.includes("High dismissal rate"))).toBe(true);
    });
  });
});
