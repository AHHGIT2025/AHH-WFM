import { prisma } from "@ahh-wfm/database";
import { mockDb } from "@ahh-wfm/mock-data";
import { WorkflowEngine } from "../../apps/web/lib/workflow-engine";
import { isUserEligibleApprover } from "../../apps/web/lib/workflow/approver-resolution";
import { executeClearanceApprove, executeClearanceReject, executeClearanceReturn, executeClearanceMarkNotApplicable } from "../../apps/web/lib/clearance-execution";
import { WorkflowAdapterRegistry } from "../../apps/web/lib/workflow/adapters/registry";

describe("PW-6 Universal Approval Center Lifecycle & Governance Suite", () => {
  const TEST_COMPANY_A = "COMP-PW6-A-001";
  const TEST_COMPANY_B = "COMP-PW6-B-002";

  const USER_APPROVER_A = {
    id: "user-approver-a-uuid",
    employeeId: "emp-approver-a-uuid",
    name: "Approver Alice",
    role: "FINANCE_DIRECTOR",
    companyId: TEST_COMPANY_A
  };

  const USER_APPROVER_B = {
    id: "user-approver-b-uuid",
    employeeId: "emp-approver-b-uuid",
    name: "Approver Bob",
    role: "OPERATIONS_DIRECTOR",
    companyId: TEST_COMPANY_A
  };

  const USER_APPROVER_C = {
    id: "user-approver-c-uuid",
    employeeId: "emp-approver-c-uuid",
    name: "Approver Charlie",
    role: "FINANCE_DIRECTOR",
    companyId: TEST_COMPANY_A
  };

  const USER_APPROVER_D = {
    id: "user-approver-d-uuid",
    employeeId: "emp-approver-d-uuid",
    name: "Approver David",
    role: "OPERATIONS_DIRECTOR",
    companyId: TEST_COMPANY_A
  };

  const USER_REQUESTER = {
    id: "user-requester-uuid",
    employeeId: "emp-requester-uuid",
    name: "Sales Requester",
    role: "SALES_AGENT",
    companyId: TEST_COMPANY_A
  };

  const USER_WRONG_COMPANY = {
    id: "user-wrong-company-uuid",
    employeeId: "emp-wrong-company-uuid",
    name: "Other Company User",
    role: "FINANCE_DIRECTOR",
    companyId: TEST_COMPANY_B
  };

  const TEST_CLEARANCE_EMP = {
    id: "emp-pw6-clearance-subject",
    name: "Clearance Test Employee",
    email: "clr.subject.pw6@alhattab.local",
    department: "Operations",
    status: "On Duty",
    role: "EMPLOYEE",
    companyId: TEST_COMPANY_A
  };

  beforeAll(async () => {
    try {
      await prisma.company.upsert({
        where: { id: TEST_COMPANY_A },
        update: {},
        create: { id: TEST_COMPANY_A, companyName: "Al Hattab Holding A", companyCode: "AHH-A" }
      });
      await prisma.company.upsert({
        where: { id: TEST_COMPANY_B },
        update: {},
        create: { id: TEST_COMPANY_B, companyName: "Al Hattab Holding B", companyCode: "AHH-B" }
      });

      // Upsert test employee for clearance foreign keys
      await prisma.employee.upsert({
        where: { id: TEST_CLEARANCE_EMP.id },
        create: TEST_CLEARANCE_EMP,
        update: { name: TEST_CLEARANCE_EMP.name }
      });

      await prisma.employee.upsert({
        where: { id: USER_APPROVER_A.id },
        create: {
          id: USER_APPROVER_A.id,
          name: USER_APPROVER_A.name,
          email: "approver.a.pw6@alhattab.local",
          department: "Finance",
          status: "On Duty",
          role: "HR_MANAGER",
          companyId: TEST_COMPANY_A
        },
        update: { name: USER_APPROVER_A.name }
      });
    } catch (e) {}
  });

  // =========================================================================
  // 1. IMMUTABLE WORKFLOW VERSIONING
  // =========================================================================
  describe("1. Immutable Workflow Template Versioning (Option A)", () => {
    let templateV1: any;
    let instanceX: any;
    let templateV2: any;
    let instanceY: any;

    it("1a. Creates Workflow Template Version 1 and submits Instance X", async () => {
      templateV1 = await mockDb.createWorkflowTemplate({
        workflowName: "Commercial Costing Approval V1",
        moduleType: "PW6_TEST_COSTING",
        isDefault: true,
        isActive: true,
        levels: [
          {
            levelNumber: 1,
            levelName: "Finance Review",
            approvalRule: "ANY_ONE",
            approvers: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: USER_APPROVER_A.employeeId, employeeName: USER_APPROVER_A.name }]
          },
          {
            levelNumber: 2,
            levelName: "Operations Signoff",
            approvalRule: "ANY_ONE",
            approvers: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: USER_APPROVER_B.employeeId, employeeName: USER_APPROVER_B.name }]
          }
        ]
      });

      expect(templateV1.id).toBeDefined();

      // Submit Instance X on Version 1
      instanceX = await WorkflowEngine.submitCase(
        "PW6_TEST_COSTING",
        "REF-COST-001",
        TEST_COMPANY_A,
        null,
        USER_REQUESTER.id
      );

      expect(instanceX.templateId).toBe(templateV1.id);
      expect(instanceX.currentLevelNumber).toBe(1);
    });

    it("1b. Updates Workflow Setup: creates new Template V2, preserving V1 for running Instance X", async () => {
      templateV2 = await mockDb.updateWorkflowTemplate(templateV1.id, {
        workflowName: "Commercial Costing Approval V2 (Modified)",
        moduleType: "PW6_TEST_COSTING",
        isDefault: true,
        isActive: true,
        levels: [
          {
            levelNumber: 1,
            levelName: "New Finance Review",
            approvalRule: "ANY_ONE",
            approvers: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: USER_APPROVER_C.employeeId, employeeName: USER_APPROVER_C.name }]
          },
          {
            levelNumber: 2,
            levelName: "New Operations Signoff",
            approvalRule: "ANY_ONE",
            approvers: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: USER_APPROVER_D.employeeId, employeeName: USER_APPROVER_D.name }]
          }
        ]
      });

      // Proof of Option A Versioning: New ID created, old ID preserved
      expect(templateV2.id).not.toBe(templateV1.id);
      expect(templateV2.isDefault).toBe(true);

      // Verify old template still exists in DB with original Level 2 approver
      const oldTmpl = await prisma.workflowTemplate.findUnique({
        where: { id: templateV1.id },
        include: { levels: { orderBy: { levelNumber: "asc" }, include: { approvers: true } } }
      });
      expect(oldTmpl).not.toBeNull();
      expect(oldTmpl?.isDefault).toBe(false);
      expect(oldTmpl?.levels[1].approvers[0].employeeId).toBe(USER_APPROVER_B.employeeId);
    });

    it("1c. Submits new Instance Y: binds to new Template V2", async () => {
      instanceY = await WorkflowEngine.submitCase(
        "PW6_TEST_COSTING",
        "REF-COST-002",
        TEST_COMPANY_A,
        null,
        USER_REQUESTER.id
      );

      expect(instanceY.templateId).toBe(templateV2.id);
      expect(instanceY.templateId).not.toBe(instanceX.templateId);
    });

    it("1d. In-flight Instance X resolves Level 2 to Approver B (NOT Approver D)", async () => {
      // Approver A approves Level 1 of Instance X
      const updatedX1 = await WorkflowEngine.executeAction({
        instanceId: instanceX.id,
        action: "APPROVE",
        user: USER_APPROVER_A,
        remarks: "Level 1 approved by Alice"
      });

      expect(updatedX1.currentLevelNumber).toBe(2);
      expect(updatedX1.status).toBe("IN_PROGRESS");

      // Verify Level 2 approver on Instance X is still Approver B
      const instXFromDb = await prisma.workflowInstance.findUnique({
        where: { id: instanceX.id },
        include: { template: { include: { levels: { orderBy: { levelNumber: "asc" }, include: { approvers: true } } } } }
      });

      const lvl2 = instXFromDb?.template.levels.find(l => l.levelNumber === 2);
      expect(lvl2?.approvers[0].employeeId).toBe(USER_APPROVER_B.employeeId);

      // Approver B is eligible, Approver D is NOT eligible for Instance X
      const eligibilityB = await isUserEligibleApprover(USER_APPROVER_B, lvl2!.approvers);
      const eligibilityD = await isUserEligibleApprover(USER_APPROVER_D, lvl2!.approvers);

      expect(eligibilityB.isEligible).toBe(true);
      expect(eligibilityD.isEligible).toBe(false);

      // Approver B executes Level 2 on Instance X -> completes to APPROVED
      const finalX = await WorkflowEngine.executeAction({
        instanceId: instanceX.id,
        action: "APPROVE",
        user: USER_APPROVER_B,
        remarks: "Final signoff by Bob"
      });

      expect(finalX.status).toBe("APPROVED");
    });

    it("1e. Concurrent/Race-condition Workflow Setup saves maintain version completeness and deterministic default invariant", async () => {
      // Simulate two near-concurrent saves for a module
      const save1Promise = mockDb.createWorkflowTemplate({
        workflowName: "Concurrent Proposal Workflow V1",
        moduleType: "PW6_TEST_CONCURRENT_RACE",
        isDefault: true,
        isActive: true,
        levels: [
          {
            levelNumber: 1,
            levelName: "Level 1 Save A",
            approvalRule: "ANY_ONE",
            approvers: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: USER_APPROVER_A.employeeId, employeeName: USER_APPROVER_A.name }]
          }
        ]
      });

      const save2Promise = mockDb.createWorkflowTemplate({
        workflowName: "Concurrent Proposal Workflow V2",
        moduleType: "PW6_TEST_CONCURRENT_RACE",
        isDefault: true,
        isActive: true,
        levels: [
          {
            levelNumber: 1,
            levelName: "Level 1 Save B",
            approvalRule: "ANY_ONE",
            approvers: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: USER_APPROVER_B.employeeId, employeeName: USER_APPROVER_B.name }]
          }
        ]
      });

      const [res1, res2] = await Promise.all([save1Promise, save2Promise]);

      expect(res1.id).toBeDefined();
      expect(res2.id).toBeDefined();
      expect(res1.id).not.toBe(res2.id);

      // Verify both created versions are 100% complete with levels and approvers
      const tmpl1 = await prisma.workflowTemplate.findUnique({
        where: { id: res1.id },
        include: { levels: { include: { approvers: true } } }
      });
      const tmpl2 = await prisma.workflowTemplate.findUnique({
        where: { id: res2.id },
        include: { levels: { include: { approvers: true } } }
      });

      expect(tmpl1?.levels.length).toBe(1);
      expect(tmpl1?.levels[0].approvers.length).toBe(1);
      expect(tmpl2?.levels.length).toBe(1);
      expect(tmpl2?.levels[0].approvers.length).toBe(1);

      // Verify exactly one active default exists for this module type
      const defaults = await prisma.workflowTemplate.findMany({
        where: { moduleType: "PW6_TEST_CONCURRENT_RACE", isDefault: true, isActive: true }
      });
      expect(defaults.length).toBe(1);

      // Verify a new submission binds deterministically to the active default
      const raceInstance = await WorkflowEngine.submitCase(
        "PW6_TEST_CONCURRENT_RACE",
        "REF-RACE-001",
        TEST_COMPANY_A,
        null,
        USER_REQUESTER.id
      );
      expect(raceInstance.templateId).toBe(defaults[0].id);
      expect(raceInstance.currentLevelNumber).toBe(1);
    });

    it("1f. Instance Y resolves Level 2 to Approver D (NOT Approver B)", async () => {
      // Approver C approves Level 1 of Instance Y
      const updatedY1 = await WorkflowEngine.executeAction({
        instanceId: instanceY.id,
        action: "APPROVE",
        user: USER_APPROVER_C,
        remarks: "Level 1 approved by Charlie"
      });

      expect(updatedY1.currentLevelNumber).toBe(2);

      const instYFromDb = await prisma.workflowInstance.findUnique({
        where: { id: instanceY.id },
        include: { template: { include: { levels: { orderBy: { levelNumber: "asc" }, include: { approvers: true } } } } }
      });

      const lvl2Y = instYFromDb?.template.levels.find(l => l.levelNumber === 2);
      expect(lvl2Y?.approvers[0].employeeId).toBe(USER_APPROVER_D.employeeId);

      const eligibilityD = await isUserEligibleApprover(USER_APPROVER_D, lvl2Y!.approvers);
      const eligibilityB = await isUserEligibleApprover(USER_APPROVER_B, lvl2Y!.approvers);

      expect(eligibilityD.isEligible).toBe(true);
      expect(eligibilityB.isEligible).toBe(false);
    });
  });

  // =========================================================================
  // 2. ACTOR DOMAINS & EXPLICIT ASSIGNMENT PRECEDENCE
  // =========================================================================
  describe("2. Strict Actor Domains & Assignment Precedence", () => {
    it("2a. Explicit employee assignment blocks generic role fallback match", async () => {
      const levelApprovers = [
        {
          approverType: "SPECIFIC_EMPLOYEE",
          employeeId: USER_APPROVER_A.employeeId,
          employeeName: USER_APPROVER_A.name,
          roleName: "FINANCE_DIRECTOR"
        }
      ];

      const resA = await isUserEligibleApprover(USER_APPROVER_A, levelApprovers);
      const resC = await isUserEligibleApprover(USER_APPROVER_C, levelApprovers);

      expect(resA.isEligible).toBe(true);
      expect(resA.isExplicit).toBe(true);
      expect(resC.isEligible).toBe(false);
    });

    it("2b. Role-based fallback evaluates when no employeeId is assigned", async () => {
      const levelApprovers = [
        {
          approverType: "ROLE_BASED",
          employeeId: null,
          roleName: "FINANCE_DIRECTOR"
        }
      ];

      const resA = await isUserEligibleApprover(USER_APPROVER_A, levelApprovers);
      const resC = await isUserEligibleApprover(USER_APPROVER_C, levelApprovers);
      const resB = await isUserEligibleApprover(USER_APPROVER_B, levelApprovers);

      expect(resA.isEligible).toBe(true);
      expect(resC.isEligible).toBe(true);
      expect(resB.isEligible).toBe(false);
    });
  });

  // =========================================================================
  // 3. SEGREGATION OF DUTIES & COMPANY BOUNDARIES
  // =========================================================================
  describe("3. SoD and Company Boundary Guards", () => {
    it("3a. Creator cannot approve own request (SoD Restriction)", async () => {
      const levelApprovers = [
        {
          approverType: "ROLE_BASED",
          employeeId: null,
          roleName: "SALES_AGENT"
        }
      ];

      const res = await isUserEligibleApprover(USER_REQUESTER, levelApprovers, {
        creatorId: USER_REQUESTER.id
      });

      expect(res.isEligible).toBe(false);
      expect(res.reason).toContain("Segregation of Duties");
    });

    it("3b. Cross-company user is blocked by company boundary", async () => {
      const levelApprovers = [
        {
          approverType: "ROLE_BASED",
          employeeId: null,
          roleName: "FINANCE_DIRECTOR"
        }
      ];

      const res = await isUserEligibleApprover(USER_WRONG_COMPANY, levelApprovers, {
        instanceCompanyId: TEST_COMPANY_A
      });

      expect(res.isEligible).toBe(false);
      expect(res.reason).toContain("Company boundary");
    });
  });

  // =========================================================================
  // 4. PARALLEL RULES: ALL_REQUIRED FAIL-CLOSED
  // =========================================================================
  describe("4. Parallel Approval Rule: ALL_REQUIRED Fail-Closed", () => {
    let parallelTmpl: any;
    let parallelInst: any;

    it("4a. Template with ALL_REQUIRED fails closed on single-action execution", async () => {
      parallelTmpl = await mockDb.createWorkflowTemplate({
        workflowName: "Parallel Costing Test",
        moduleType: "PW6_PARALLEL_TEST",
        isDefault: true,
        isActive: true,
        levels: [
          {
            levelNumber: 1,
            levelName: "Parallel Dual Review",
            approvalRule: "ALL_REQUIRED",
            approvers: [
              { approverType: "SPECIFIC_EMPLOYEE", employeeId: USER_APPROVER_A.employeeId, employeeName: USER_APPROVER_A.name },
              { approverType: "SPECIFIC_EMPLOYEE", employeeId: USER_APPROVER_B.employeeId, employeeName: USER_APPROVER_B.name }
            ]
          }
        ]
      });

      parallelInst = await WorkflowEngine.submitCase(
        "PW6_PARALLEL_TEST",
        "REF-PARALLEL-001",
        TEST_COMPANY_A,
        null,
        USER_REQUESTER.id
      );

      // Verify fail closed: throws error, no action history recorded, state unchanged
      await expect(
        WorkflowEngine.executeAction({
          instanceId: parallelInst.id,
          action: "APPROVE",
          user: USER_APPROVER_A,
          remarks: "Parallel approval test"
        })
      ).rejects.toThrow("UNSUPPORTED_WORKFLOW_RULE: ALL_REQUIRED");

      const checkInst = await prisma.workflowInstance.findUnique({
        where: { id: parallelInst.id },
        include: { history: true }
      });
      expect(checkInst?.status).toBe("IN_PROGRESS");
      expect(checkInst?.currentLevelNumber).toBe(1);
      // History should only have SUBMIT, no APPROVE
      expect(checkInst?.history.filter(h => h.action === "APPROVE").length).toBe(0);
    });
  });

  // =========================================================================
  // 5. STALE / REPLAY ACTION PROTECTION
  // =========================================================================
  describe("5. Replay & Stale Action Protection", () => {
    it("5b. Cannot act on an already completed or non-pending instance", async () => {
      const tmpl = await mockDb.createWorkflowTemplate({
        workflowName: "Single Step Replay Test",
        moduleType: "PW6_REPLAY_TEST",
        isDefault: true,
        isActive: true,
        levels: [
          {
            levelNumber: 1,
            levelName: "Single Step",
            approvalRule: "ANY_ONE",
            approvers: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: USER_APPROVER_A.employeeId, employeeName: USER_APPROVER_A.name }]
          }
        ]
      });

      const inst = await WorkflowEngine.submitCase(
        "PW6_REPLAY_TEST",
        "REF-REPLAY-001",
        TEST_COMPANY_A,
        null,
        USER_REQUESTER.id
      );

      // First approval succeeds
      await WorkflowEngine.executeAction({
        instanceId: inst.id,
        action: "APPROVE",
        user: USER_APPROVER_A,
        remarks: "Valid approval"
      });

      // Second approval attempt on the completed workflow must be rejected
      await expect(
        WorkflowEngine.executeAction({
          instanceId: inst.id,
          action: "APPROVE",
          user: USER_APPROVER_A,
          remarks: "Duplicate replay approval"
        })
      ).rejects.toThrow("Workflow instance is not pending");
    });
  });

  // =========================================================================
  // 6. INBOX & OUTBOX SEMANTICS
  // =========================================================================
  describe("6. Inbox & Outbox Lifecycle Semantics", () => {
    let outboxTmpl: any;
    let outboxInst: any;

    beforeAll(async () => {
      outboxTmpl = await mockDb.createWorkflowTemplate({
        workflowName: "Outbox Semantics Test",
        moduleType: "PW6_OUTBOX_TEST",
        isDefault: true,
        isActive: true,
        levels: [
          {
            levelNumber: 1,
            levelName: "L1 Review",
            approvalRule: "ANY_ONE",
            approvers: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: USER_APPROVER_A.employeeId, employeeName: USER_APPROVER_A.name }]
          },
          {
            levelNumber: 2,
            levelName: "L2 Signoff",
            approvalRule: "ANY_ONE",
            approvers: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: USER_APPROVER_B.employeeId, employeeName: USER_APPROVER_B.name }]
          }
        ]
      });

      outboxInst = await WorkflowEngine.submitCase(
        "PW6_OUTBOX_TEST",
        "REF-OUTBOX-001",
        TEST_COMPANY_A,
        null,
        USER_REQUESTER.id
      );
    });

    it("6a. SUBMIT is excluded from Outbox for the requester", async () => {
      // Query WorkflowActionHistory for user: SUBMIT must not count as approver action
      const userHistories = await prisma.workflowActionHistory.findMany({
        where: {
          actedBy: USER_REQUESTER.id,
          action: { in: ["APPROVE", "REJECT", "RETURN", "MARK_NOT_APPLICABLE"] }
        }
      });
      const matching = userHistories.filter(h => h.instanceId === outboxInst.id);
      expect(matching.length).toBe(0);
    });

    it("6b. APPROVE enters Outbox with correct action, date, and current live status", async () => {
      await WorkflowEngine.executeAction({
        instanceId: outboxInst.id,
        action: "APPROVE",
        user: USER_APPROVER_A,
        remarks: "Approved by Alice"
      });

      const userHistories = await prisma.workflowActionHistory.findMany({
        where: {
          actedBy: USER_APPROVER_A.id,
          action: { in: ["APPROVE", "REJECT", "RETURN", "MARK_NOT_APPLICABLE"] },
          instanceId: outboxInst.id
        },
        include: { instance: true }
      });

      expect(userHistories.length).toBe(1);
      expect(userHistories[0].action).toBe("APPROVE");
      expect(userHistories[0].instance.currentLevelNumber).toBe(2);
      expect(userHistories[0].instance.status).toBe("IN_PROGRESS");
    });

    it("6c. Future progress by Approver B updates live status visible to Approver A", async () => {
      await WorkflowEngine.executeAction({
        instanceId: outboxInst.id,
        action: "APPROVE",
        user: USER_APPROVER_B,
        remarks: "Final approved by Bob"
      });

      // Approver A's Outbox entry now reflects completed status
      const inst = await prisma.workflowInstance.findUnique({
        where: { id: outboxInst.id }
      });
      expect(inst?.status).toBe("APPROVED");
    });

    it("6d. RETURN action enters Outbox and marks status RETURNED", async () => {
      const retInst = await WorkflowEngine.submitCase(
        "PW6_OUTBOX_TEST",
        "REF-OUTBOX-002",
        TEST_COMPANY_A,
        null,
        USER_REQUESTER.id
      );

      await WorkflowEngine.executeAction({
        instanceId: retInst.id,
        action: "RETURN",
        user: USER_APPROVER_A,
        remarks: "Need more data"
      });

      const userHistories = await prisma.workflowActionHistory.findMany({
        where: {
          actedBy: USER_APPROVER_A.id,
          instanceId: retInst.id,
          action: "RETURN"
        }
      });
      expect(userHistories.length).toBe(1);

      const checkInst = await prisma.workflowInstance.findUnique({ where: { id: retInst.id } });
      expect(checkInst?.status).toBe("RETURNED");
    });

    it("6e. REJECT action enters Outbox and marks status REJECTED", async () => {
      const rejInst = await WorkflowEngine.submitCase(
        "PW6_OUTBOX_TEST",
        "REF-OUTBOX-003",
        TEST_COMPANY_A,
        null,
        USER_REQUESTER.id
      );

      await WorkflowEngine.executeAction({
        instanceId: rejInst.id,
        action: "REJECT",
        user: USER_APPROVER_A,
        remarks: "Declined"
      });

      const userHistories = await prisma.workflowActionHistory.findMany({
        where: {
          actedBy: USER_APPROVER_A.id,
          instanceId: rejInst.id,
          action: "REJECT"
        }
      });
      expect(userHistories.length).toBe(1);

      const checkInst = await prisma.workflowInstance.findUnique({ where: { id: rejInst.id } });
      expect(checkInst?.status).toBe("REJECTED");
    });
  });

  // =========================================================================
  // 7. CLEARANCE & MARK_NOT_APPLICABLE
  // =========================================================================
  describe("7. Clearance Service Execution & MARK_NOT_APPLICABLE", () => {
    let clearanceReq: any;

    it("7a. executeClearanceApprove updates step and history deterministically", async () => {
      clearanceReq = await prisma.clearanceRequest.create({
        data: {
          clearanceNumber: `CLR-PW6-${Date.now()}`,
          companyId: TEST_COMPANY_A,
          employeeId: TEST_CLEARANCE_EMP.id,
          employeeNameSnapshot: TEST_CLEARANCE_EMP.name,
          clearanceType: "SEPARATION",
          requestedById: TEST_CLEARANCE_EMP.id,
          status: "IN_PROGRESS",
          approvalSteps: {
            create: [
              {
                stepOrder: 1,
                sectionName: "Finance Clearance",
                assignedApproverId: USER_APPROVER_A.id,
                status: "PENDING"
              },
              {
                stepOrder: 2,
                sectionName: "IT Clearance",
                assignedApproverId: USER_APPROVER_A.id,
                status: "PENDING"
              }
            ]
          }
        },
        include: { approvalSteps: true }
      });

      const step1 = clearanceReq.approvalSteps[0];
      const res1 = await executeClearanceApprove(clearanceReq.id, USER_APPROVER_A, {
        stepId: step1.id,
        remarks: "Finance cleared"
      });
      expect(res1.success).toBe(true);

      const step2 = clearanceReq.approvalSteps[1];
      const res2 = await executeClearanceMarkNotApplicable(clearanceReq.id, USER_APPROVER_A, {
        stepId: step2.id,
        remarks: "No IT assets assigned"
      });
      expect(res2.success).toBe(true);

      // Verify all steps non-pending -> completed
      const finalReq = await prisma.clearanceRequest.findUnique({
        where: { id: clearanceReq.id },
        include: { approvalSteps: true }
      });
      expect(finalReq?.status).toBe("COMPLETED");
      expect(finalReq?.approvalSteps[1].status).toBe("NOT_APPLICABLE");
    });
  });

  // =========================================================================
  // 8. ADAPTER INTEGRITY & READ/TRACKING MODULES
  // =========================================================================
  describe("8. Adapter Integrity for Leave and Calendar", () => {
    it("8a. Leave Request adapter provides safe deep link and read-only attributes", async () => {
      const adapter = WorkflowAdapterRegistry.get("LEAVE_REQUEST");
      expect(adapter).toBeDefined();
      expect(adapter?.moduleType).toBe("LEAVE_REQUEST");
      expect(adapter?.getSourceDeepLink("leave-123")).toBe("/leave");
      
      const leave = await prisma.leaveRequest.findFirst();
      if (leave) {
        const summary = await adapter?.getBusinessSummary(leave.id);
        expect(summary).not.toBeNull();
        expect(summary?.reference).toContain("LEAVE-");
        expect(summary?.keyFields.length).toBeGreaterThan(0);
      }
    });

    it("8b. Manpower Calendar adapter provides deep link to /settings/manpower-calendars", async () => {
      const adapter = WorkflowAdapterRegistry.get("MANPOWER_CALENDAR");
      expect(adapter).toBeDefined();
      expect(adapter?.moduleType).toBe("MANPOWER_CALENDAR");
      expect(adapter?.getSourceDeepLink("cal-123")).toBe("/settings/manpower-calendars");

      const cal = await prisma.manpowerHolidayCalendar.findFirst();
      if (cal) {
        const summary = await adapter?.getBusinessSummary(cal.id);
        expect(summary).not.toBeNull();
        expect(summary?.reference).toContain("CAL-");
        expect(summary?.keyFields.length).toBeGreaterThan(0);
      }
    });
  });
});
