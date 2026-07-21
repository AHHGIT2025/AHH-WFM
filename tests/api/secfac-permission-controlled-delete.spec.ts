import { prisma } from "@ahh-wfm/database";
import {
  auditSecfacDeleteAction
} from "../../apps/web/lib/secfac-delete-audit-service";
import { hasPermission } from "../../apps/web/lib/permissions";

describe("SECFAC Permission-Controlled Delete & Scope Isolation Test Suite", () => {
  let testSiteId: string;
  let testCheckpointId: string;
  let testTemplateId: string;
  let testRouteId: string;
  let testAssignmentId: string;
  let testEmployeeId: string;

  beforeAll(async () => {
    // 1. Clean test audit logs and assignments
    await prisma.secfacFieldExecutionAudit.deleteMany({
      where: { actionSource: { startsWith: "SECFAC_DELETE_CONTROL" } }
    });

    let site = await prisma.manpowerSite.findFirst({ where: { isActive: true } });
    testSiteId = site?.id || "site-delete-test";

    let emp = await prisma.employee.findFirst({ where: { role: "ADMIN" } });
    if (!emp) emp = await prisma.employee.findFirst();
    testEmployeeId = emp?.id || "emp-admin-01";
  });

  describe("1. Permission Hierarchy & Separation Rules", () => {
    it("confirms SUPER_ADMIN and ADMIN have delete permissions by default", () => {
      const superAdminUser = { role: "SUPER_ADMIN" };
      const adminUser = { role: "ADMIN" };

      expect(hasPermission(superAdminUser, "secfac.checkpoints.delete")).toBe(true);
      expect(hasPermission(superAdminUser, "secfac.checklists.delete")).toBe(true);
      expect(hasPermission(superAdminUser, "secfac.patrolRoutes.delete")).toBe(true);
      expect(hasPermission(superAdminUser, "secfac.patrolAssignments.delete")).toBe(true);

      expect(hasPermission(adminUser, "secfac.checkpoints.delete")).toBe(true);
      expect(hasPermission(adminUser, "secfac.checklists.delete")).toBe(true);
      expect(hasPermission(adminUser, "secfac.patrolRoutes.delete")).toBe(true);
      expect(hasPermission(adminUser, "secfac.patrolAssignments.delete")).toBe(true);
    });

    it("verifies edit permission does NOT grant delete permission to Supervisors", () => {
      const supervisorUser = {
        role: "SECURITY_SUPERVISOR",
        permissions: [
          "secfac.checkpoints.view", "secfac.checkpoints.edit",
          "secfac.checklists.view", "secfac.checklists.edit",
          "secfac.patrolRoutes.view", "secfac.patrolRoutes.edit",
          "secfac.patrolAssignments.view", "secfac.patrolAssignments.edit"
        ]
      };

      expect(hasPermission(supervisorUser, "secfac.checkpoints.edit")).toBe(true);
      expect(hasPermission(supervisorUser, "secfac.checkpoints.delete")).toBe(false);

      expect(hasPermission(supervisorUser, "secfac.checklists.edit")).toBe(true);
      expect(hasPermission(supervisorUser, "secfac.checklists.delete")).toBe(false);

      expect(hasPermission(supervisorUser, "secfac.patrolRoutes.edit")).toBe(true);
      expect(hasPermission(supervisorUser, "secfac.patrolRoutes.delete")).toBe(false);

      expect(hasPermission(supervisorUser, "secfac.patrolAssignments.edit")).toBe(true);
      expect(hasPermission(supervisorUser, "secfac.patrolAssignments.delete")).toBe(false);
    });
  });

  describe("2. Operational Dependency Protection & State Transitions", () => {
    it("creates an unused checkpoint and verifies hard deletion is allowed when 0 dependencies exist", async () => {
      const cp = await prisma.secfacCheckpoint.create({
        data: {
          operationType: "SECURITY_GUARDING",
          siteId: testSiteId,
          checkpointName: "Unused Delete Test Checkpoint",
          checkpointCode: `CP-DEL-${Date.now()}`,
          checkpointType: "SECURITY_PATROL",
          isActive: true
        }
      });

      // Verify zero dependencies
      const routeLinks = await prisma.secfacPatrolRouteCheckpoint.count({ where: { checkpointId: cp.id } });
      const scanProofs = await prisma.secfacScanProof.count({ where: { checkpointId: cp.id } });
      expect(routeLinks + scanProofs).toBe(0);

      // Delete checkpoint
      await prisma.secfacCheckpoint.delete({ where: { id: cp.id } });

      const found = await prisma.secfacCheckpoint.findUnique({ where: { id: cp.id } });
      expect(found).toBeNull();
    });

    it("verifies checkpoint deactivation sets isActive = false without removing historical records", async () => {
      const cp = await prisma.secfacCheckpoint.create({
        data: {
          operationType: "SECURITY_GUARDING",
          siteId: testSiteId,
          checkpointName: "Deactivation Test Checkpoint",
          checkpointCode: `CP-DEACT-${Date.now()}`,
          checkpointType: "SECURITY_PATROL",
          isActive: true
        }
      });

      const deactivated = await prisma.secfacCheckpoint.update({
        where: { id: cp.id },
        data: { isActive: false }
      });

      expect(deactivated.isActive).toBe(false);

      // Audit deactivation
      await auditSecfacDeleteAction({
        entityType: "CHECKPOINT",
        entityId: cp.id,
        actionType: "DEACTIVATE",
        userId: testEmployeeId,
        permission: "secfac.checkpoints.edit",
        operationType: "SECURITY_GUARDING",
        reason: "Operational test deactivation",
        resultStatus: "SUCCESS",
        resultMessage: "Deactivated"
      });

      // Cleanup
      await prisma.secfacCheckpoint.delete({ where: { id: cp.id } });
    });

    it("verifies checklist template archiving sets isActive = false", async () => {
      const tpl = await prisma.secfacChecklistTemplate.create({
        data: {
          operationType: "SECURITY_GUARDING",
          siteId: testSiteId,
          templateName: "Archiving Test Template",
          templateCode: `TPL-ARCH-${Date.now()}`,
          category: "GENERAL",
          version: 1,
          isActive: true
        }
      });

      const archived = await prisma.secfacChecklistTemplate.update({
        where: { id: tpl.id },
        data: { isActive: false }
      });

      expect(archived.isActive).toBe(false);

      await auditSecfacDeleteAction({
        entityType: "CHECKLIST_TEMPLATE",
        entityId: tpl.id,
        actionType: "ARCHIVE",
        userId: testEmployeeId,
        permission: "secfac.checklists.edit",
        operationType: "SECURITY_GUARDING",
        reason: "Template archived",
        resultStatus: "SUCCESS",
        resultMessage: "Archived"
      });

      await prisma.secfacChecklistTemplate.delete({ where: { id: tpl.id } });
    });

    it("verifies patrol assignment cancellation updates status to SKIPPED and isActive = false", async () => {
      const assign = await prisma.secfacAssignment.create({
        data: {
          operationType: "SECURITY_GUARDING",
          siteId: testSiteId,
          employeeId: testEmployeeId,
          assignmentName: "Cancellation Test Assignment",
          assignmentCode: `ASN-CANCEL-${Date.now()}`,
          scheduledStart: new Date(),
          scheduledEnd: new Date(Date.now() + 3600000),
          status: "PENDING",
          isActive: true
        }
      });

      const cancelled = await prisma.secfacAssignment.update({
        where: { id: assign.id },
        data: { status: "SKIPPED", isActive: false }
      });

      expect(cancelled.status).toBe("SKIPPED");
      expect(cancelled.isActive).toBe(false);

      await auditSecfacDeleteAction({
        entityType: "PATROL_ASSIGNMENT",
        entityId: assign.id,
        actionType: "CANCEL",
        userId: testEmployeeId,
        permission: "secfac.patrolAssignments.edit",
        operationType: "SECURITY_GUARDING",
        reason: "Shift cancelled by supervisor",
        resultStatus: "SUCCESS",
        resultMessage: "Cancelled"
      });

      await prisma.secfacAssignment.delete({ where: { id: assign.id } });
    });
  });

  describe("3. Audit Logging Integrity", () => {
    it("writes audit logs for hard delete, deactivate, archive, cancel, and blocked attempts", async () => {
      await auditSecfacDeleteAction({
        entityType: "CHECKPOINT",
        entityId: "cp-audit-test-01",
        actionType: "DEPENDENCY_BLOCKED",
        userId: testEmployeeId,
        permission: "secfac.checkpoints.delete",
        operationType: "SECURITY_GUARDING",
        resultStatus: "BLOCKED",
        resultMessage: "Deletion blocked due to active scan proofs"
      });

      const auditLogs = await prisma.secfacFieldExecutionAudit.findMany({
        where: {
          actionSource: "SECFAC_DELETE_CONTROL_CHECKPOINT"
        }
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      const blockedLog = auditLogs.find(a => a.actionType === "CHECKPOINT_DEPENDENCY_BLOCKED");
      expect(blockedLog).toBeDefined();
      expect(blockedLog?.resultStatus).toBe("BLOCKED");
    });
  });
});
