import { prisma } from "@ahh-wfm/database";
import { GET as getCrm, POST as postCrm, PATCH as patchCrm } from "../../apps/web/app/api/v1/commercial/crm/route";
import { GET as getOpportunities, POST as postOpportunities, PATCH as patchOpportunities } from "../../apps/web/app/api/v1/commercial/opportunities/route";
import { POST as postWorkflow } from "../../apps/web/app/api/v1/commercial/opportunities/[id]/workflow/route";
import { getServerSession } from "next-auth/next";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn()
}));

describe("Commercial Lifecycle — Phase CL-1 Suite (Workflow Governance & Security Verification)", () => {
  const mockAdminUser = {
    id: "EMP-ADMIN-CL1",
    name: "Commercial Admin CL1",
    role: "SUPER_ADMIN",
    permissions: [
      "manpower.admin.full_access",
      "precontract.prospectClient.view",
      "precontract.prospectClient.manage",
      "precontract.case.view",
      "precontract.case.manage",
      "precontract.workflow.submit",
      "precontract.workflow.approve",
      "precontract.workflow.review"
    ],
    operationAccess: {
      allowedSecurityGuarding: true,
      allowedFacilityManagement: true
    }
  };

  const mockSgUser = {
    id: "EMP-SG-CL1",
    name: "SG Commercial Officer",
    role: "SECURITY_ADMIN",
    companyId: "COMP-CL1-01",
    permissions: [
      "precontract.prospectClient.view",
      "precontract.prospectClient.manage",
      "precontract.case.view",
      "precontract.case.manage",
      "precontract.workflow.submit"
    ],
    operationAccess: {
      allowedSecurityGuarding: true,
      allowedFacilityManagement: false
    }
  };

  const mockFmUser = {
    id: "EMP-FM-CL1",
    name: "FM Commercial Manager",
    role: "FM_ADMIN",
    companyId: "COMP-CL1-01",
    permissions: [
      "precontract.prospectClient.view",
      "precontract.prospectClient.manage",
      "precontract.case.view",
      "precontract.case.manage",
      "precontract.workflow.submit",
      "precontract.workflow.approve"
    ],
    operationAccess: {
      allowedSecurityGuarding: false,
      allowedFacilityManagement: true
    }
  };

  const mockLevel1Approver = {
    id: "EMP-L1-APPROVER",
    name: "Level 1 Approver",
    role: "COMMERCIAL_SUPERVISOR",
    companyId: "COMP-CL1-01",
    permissions: [
      "precontract.case.view",
      "precontract.workflow.approve"
    ],
    operationAccess: {
      allowedSecurityGuarding: true,
      allowedFacilityManagement: true
    }
  };

  const mockLevel2Approver = {
    id: "EMP-L2-APPROVER",
    name: "Level 2 Director Approver",
    role: "COMMERCIAL_DIRECTOR",
    companyId: "COMP-CL1-01",
    permissions: [
      "precontract.case.view",
      "precontract.workflow.approve"
    ],
    operationAccess: {
      allowedSecurityGuarding: true,
      allowedFacilityManagement: true
    }
  };

  const mockUnauthorizedUser = {
    id: "EMP-NO-PERM-CL1",
    name: "No Permission User",
    role: "EMPLOYEE",
    permissions: ["self.profile.view"],
    operationAccess: {
      allowedSecurityGuarding: true,
      allowedFacilityManagement: false
    }
  };

  let testCompany: any;
  let testClientMaster: any;
  let testProspectClient: any;
  let testMultiLevelTemplate: any;
  let testCase: any;

  beforeAll(async () => {
    // Clean up any stale template first using raw SQL to bypass foreign key constraints safely
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM WorkflowActionHistory WHERE instanceId IN (SELECT id FROM WorkflowInstance WHERE templateId = 'WF-TMPL-CL1-MULTILEVEL')`);
      await prisma.$executeRawUnsafe(`DELETE FROM WorkflowInstance WHERE templateId = 'WF-TMPL-CL1-MULTILEVEL'`);
      await prisma.$executeRawUnsafe(`DELETE FROM WorkflowTemplateApprover WHERE levelId IN (SELECT id FROM WorkflowTemplateLevel WHERE templateId = 'WF-TMPL-CL1-MULTILEVEL')`);
      await prisma.$executeRawUnsafe(`DELETE FROM WorkflowTemplateLevel WHERE templateId = 'WF-TMPL-CL1-MULTILEVEL'`);
      await prisma.$executeRawUnsafe(`DELETE FROM WorkflowTemplate WHERE id = 'WF-TMPL-CL1-MULTILEVEL'`);
      await prisma.preContractCase.deleteMany({
        where: { title: { contains: "Lusail Katara Security" } }
      });
      await prisma.preContractProspectClient.deleteMany({
        where: { crNumber: { in: ["CR-UNIQUE-776655", "CR-998877"] } }
      });
    } catch (e) {}

    // 1. Setup Test Master & Company
    testCompany = await prisma.company.upsert({
      where: { id: "COMP-CL1-01" },
      update: {},
      create: {
        id: "COMP-CL1-01",
        companyCode: "COMPCL1",
        companyName: "CL1 Workflow Test Company"
      }
    });

    testClientMaster = await prisma.manpowerClient.upsert({
      where: { id: "CLI-CL1-MASTER" },
      update: {},
      create: {
        id: "CLI-CL1-MASTER",
        operationType: "SECURITY_GUARDING",
        code: "CR-998877",
        name: "Existing Master Client WLL"
      }
    });

    // 2. Setup Centralized Multi-Level Workflow Template in Settings > Workflow Setup
    testMultiLevelTemplate = await prisma.workflowTemplate.create({
      data: {
        id: "WF-TMPL-CL1-MULTILEVEL",
        workflowName: "Commercial Case Multi-Level Approval",
        moduleType: "PRE_CONTRACT_CASE",
        operationType: "SECURITY_GUARDING",
        appliesTo: "ACTIVATION",
        isDefault: true,
        isActive: true,
        remarks: "Central workflow setup with 2 approval levels",
        levels: {
          create: [
            {
              levelNumber: 1,
              levelName: "Level 1 Commercial Review",
              approvalRule: "ANY_ONE",
              isMandatory: true,
              approvers: {
                create: [
                  {
                    approverType: "ROLE_BASED",
                    roleName: "COMMERCIAL_SUPERVISOR"
                  }
                ]
              }
            },
            {
              levelNumber: 2,
              levelName: "Level 2 Executive Director Approval",
              approvalRule: "ANY_ONE",
              isMandatory: true,
              approvers: {
                create: [
                  {
                    approverType: "ROLE_BASED",
                    roleName: "COMMERCIAL_DIRECTOR"
                  }
                ]
              }
            }
          ]
        }
      }
    });
  });

  afterAll(async () => {
    try {
      if (testCase?.id) {
        await prisma.workflowActionHistory.deleteMany({
          where: { instance: { referenceId: testCase.id } }
        });
        await prisma.workflowInstance.deleteMany({
          where: { referenceId: testCase.id }
        });
        await prisma.preContractCase.deleteMany({ where: { id: testCase.id } });
      }
      if (testMultiLevelTemplate?.id) {
        await prisma.$executeRawUnsafe(`DELETE FROM WorkflowTemplateApprover WHERE levelId IN (SELECT id FROM WorkflowTemplateLevel WHERE templateId = '${testMultiLevelTemplate.id}')`);
        await prisma.$executeRawUnsafe(`DELETE FROM WorkflowTemplateLevel WHERE templateId = '${testMultiLevelTemplate.id}'`);
        await prisma.$executeRawUnsafe(`DELETE FROM WorkflowTemplate WHERE id = '${testMultiLevelTemplate.id}'`);
      }
      if (testProspectClient?.id) {
        await prisma.preContractProspectClient.deleteMany({ where: { id: testProspectClient.id } });
      }
      if (testClientMaster?.id) {
        await prisma.manpowerClient.deleteMany({ where: { id: testClientMaster.id } });
      }
      if (testCompany?.id) {
        await prisma.company.deleteMany({ where: { id: testCompany.id } });
      }
    } catch (e) {}
  });

  it("1. Unauthenticated CRM request returns 401", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const req = new Request("http://localhost/api/v1/commercial/crm");
    const res = await getCrm(req);
    expect(res.status).toBe(401);
  });

  it("2. Unauthorized CRM request returns 403", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockUnauthorizedUser });
    const req = new Request("http://localhost/api/v1/commercial/crm");
    const res = await getCrm(req);
    expect(res.status).toBe(403);
  });

  it("3. Registering unique prospect client sets CLEARED duplicate status", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request("http://localhost/api/v1/commercial/crm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Unique Commercial Client WLL",
        crNumber: "CR-UNIQUE-776655",
        contactPersonName: "Saeed Al-Hajri",
        operationType: "SECURITY_GUARDING"
      })
    });

    const res = await postCrm(req);
    expect(res.status).toBe(201);
    const json = await res.json();

    expect(json.prospect.name).toBe("Unique Commercial Client WLL");
    expect(json.prospect.duplicateCheckStatus).toBe("CLEARED");

    testProspectClient = json.prospect;
  });

  it("4. Registering duplicate prospect client matching existing CR number triggers MATCH_FOUND status", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request("http://localhost/api/v1/commercial/crm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Duplicate Master Client Prospect",
        crNumber: "CR-998877", // Matches testClientMaster.code
        operationType: "SECURITY_GUARDING"
      })
    });

    const res = await postCrm(req);
    expect(res.status).toBe(201);
    const json = await res.json();

    expect(json.prospect.duplicateCheckStatus).toBe("MATCH_FOUND");
    expect(json.prospect.matchedClientMasterId).toBe(testClientMaster.id);

    // Clean up temporary duplicate prospect
    await prisma.preContractProspectClient.delete({ where: { id: json.prospect.id } });
  });

  it("5. Company isolation locks companyId filter for company-bound user", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockSgUser });
    const req = new Request("http://localhost/api/v1/commercial/crm");
    const res = await getCrm(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.prospects)).toBe(true);
  });

  it("6. SG-scoped user requesting FM operational data gets 403 scope isolation error", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockSgUser });
    const req = new Request("http://localhost/api/v1/commercial/crm?operationType=FACILITY_MANAGEMENT");
    const res = await getCrm(req);
    expect(res.status).toBe(403);
  });

  it("7. FM-scoped user requesting SG operational data gets 403 scope isolation error", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockFmUser });
    const req = new Request("http://localhost/api/v1/commercial/crm?operationType=SECURITY_GUARDING");
    const res = await getCrm(req);
    expect(res.status).toBe(403);
  });

  it("8. Opportunity starts in valid initial state (DRAFT)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request("http://localhost/api/v1/commercial/opportunities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Lusail Katara Security Proposal 2026",
        prospectClientId: testProspectClient?.id,
        operationType: "SECURITY_GUARDING"
      })
    });

    const res = await postOpportunities(req);
    expect(res.status).toBe(201);
    const json = await res.json();

    expect(json.case.title).toBe("Lusail Katara Security Proposal 2026");
    expect(json.case.lifecycle).toBe("DRAFT");
    expect(json.case.businessOutcome).toBe("IN_PROGRESS");

    testCase = json.case;
  });

  it("9. Submission resolves central workflow template and binds WorkflowInstance", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/opportunities/${testCase.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "SUBMIT",
        remarks: "Submitting for multi-level commercial approval"
      })
    });

    const res = await postWorkflow(req, { params: { id: testCase.id } });
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.case.lifecycle).toBe("IN_WORKFLOW");
    expect(json.workflow.action).toBe("SUBMIT");
    expect(json.workflow.status).toBe("IN_PROGRESS");
    expect(json.workflow.currentLevelNumber).toBe(1);
  });

  it("10. Missing mandatory workflow configuration is rejected when template deactivated", async () => {
    // Temporarily deactivate workflow template
    await prisma.workflowTemplate.update({
      where: { id: testMultiLevelTemplate.id },
      data: { isActive: false }
    });

    // Create temporary case
    const tempCase = await prisma.preContractCase.create({
      data: {
        title: "No Template Test Case",
        operationType: "SECURITY_GUARDING",
        lifecycle: "DRAFT",
        createdBy: mockAdminUser.id
      }
    });

    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/opportunities/${tempCase.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SUBMIT" })
    });

    const res = await postWorkflow(req, { params: { id: tempCase.id } });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Missing Workflow Configuration");

    // Re-activate template and clean up
    await prisma.workflowTemplate.update({
      where: { id: testMultiLevelTemplate.id },
      data: { isActive: true }
    });
    await prisma.preContractCase.delete({ where: { id: tempCase.id } });
  });

  it("11. WorkflowInstance created correctly with starting level = 1", async () => {
    const instance = await prisma.workflowInstance.findFirst({
      where: { referenceId: testCase.id }
    });

    expect(instance).toBeDefined();
    expect(instance?.templateId).toBe(testMultiLevelTemplate.id);
    expect(instance?.currentLevelNumber).toBe(1);
    expect(instance?.status).toBe("IN_PROGRESS");
  });

  it("12. Level 1 approval authorization accepts valid Level 1 approver role", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockLevel1Approver });
    const req = new Request(`http://localhost/api/v1/commercial/opportunities/${testCase.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "APPROVE",
        remarks: "Level 1 Supervisor approval granted."
      })
    });

    const res = await postWorkflow(req, { params: { id: testCase.id } });
    expect(res.status).toBe(200);
  });

  it("13. Unauthorized approver (Level 1 approver attempting Level 2) is rejected with 403", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockLevel1Approver });
    const req = new Request(`http://localhost/api/v1/commercial/opportunities/${testCase.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "APPROVE",
        remarks: "Unauthorized attempt to approve Level 2."
      })
    });

    const res = await postWorkflow(req, { params: { id: testCase.id } });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("not an authorized approver for Level 2");
  });

  it("14. Multi-level workflow advancement keeps lifecycle IN_WORKFLOW after Level 1 approval", async () => {
    const updatedCase = await prisma.preContractCase.findUnique({
      where: { id: testCase.id }
    });
    const instance = await prisma.workflowInstance.findFirst({
      where: { referenceId: testCase.id }
    });

    expect(updatedCase?.lifecycle).toBe("IN_WORKFLOW");
    expect(instance?.currentLevelNumber).toBe(2);
    expect(instance?.status).toBe("IN_PROGRESS");
  });

  it("15. Final approval only occurs after configured Level 2 is approved", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockLevel2Approver });
    const req = new Request(`http://localhost/api/v1/commercial/opportunities/${testCase.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "APPROVE",
        remarks: "Level 2 Executive Director final approval granted."
      })
    });

    const res = await postWorkflow(req, { params: { id: testCase.id } });
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.case.lifecycle).toBe("COMPLETED");
    expect(json.case.businessOutcome).toBe("WON");
    expect(json.workflow.status).toBe("APPROVED");
  });

  it("16. RETURN behavior resets workflow to Level 1 and lifecycle to DRAFT", async () => {
    // Submit case again
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const submitReq = new Request(`http://localhost/api/v1/commercial/opportunities/${testCase.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SUBMIT", remarks: "Resubmitting for review" })
    });
    await postWorkflow(submitReq, { params: { id: testCase.id } });

    // Execute RETURN action
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockLevel1Approver });
    const returnReq = new Request(`http://localhost/api/v1/commercial/opportunities/${testCase.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "RETURN", remarks: "Returning for scope clarification" })
    });

    const res = await postWorkflow(returnReq, { params: { id: testCase.id } });
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.case.lifecycle).toBe("DRAFT");
    expect(json.workflow.status).toBe("RETURNED");
    expect(json.workflow.currentLevelNumber).toBe(1);
  });

  it("17. REJECT behavior transitions workflow to REJECTED and lifecycle to CANCELLED", async () => {
    // Resubmit case
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const submitReq = new Request(`http://localhost/api/v1/commercial/opportunities/${testCase.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SUBMIT", remarks: "Final resubmission" })
    });
    await postWorkflow(submitReq, { params: { id: testCase.id } });

    // Execute REJECT action
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockLevel1Approver });
    const rejectReq = new Request(`http://localhost/api/v1/commercial/opportunities/${testCase.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REJECT", remarks: "Unviable margin rejected" })
    });

    const res = await postWorkflow(rejectReq, { params: { id: testCase.id } });
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.case.lifecycle).toBe("CANCELLED");
    expect(json.case.businessOutcome).toBe("LOST");
    expect(json.workflow.status).toBe("REJECTED");
  });

  it("18. Invalid workflow action returns 400 bad request error", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/opportunities/${testCase.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "INVALID_ACTION" })
    });

    const res = await postWorkflow(req, { params: { id: testCase.id } });
    expect(res.status).toBe(400);
  });

  it("19. WorkflowActionHistory is completely immutable and retains full action sequence", async () => {
    const history = await prisma.workflowActionHistory.findMany({
      where: { instance: { referenceId: testCase.id } },
      orderBy: { createdAt: "asc" }
    });

    expect(history.length).toBeGreaterThanOrEqual(5);
    const actions = history.map((h) => h.action);
    expect(actions).toContain("SUBMIT");
    expect(actions).toContain("APPROVE");
    expect(actions).toContain("RETURN");
    expect(actions).toContain("REJECT");
  });

  it("20. Segregation of duties prevents non-authorized requester self-approval", async () => {
    const requesterId = "EMP-CREATOR-L1";

    // Create case created by specific requester
    const sodCase = await prisma.preContractCase.create({
      data: {
        title: "SoD Test Case",
        operationType: "SECURITY_GUARDING",
        lifecycle: "DRAFT",
        createdBy: requesterId
      }
    });

    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const submitReq = new Request(`http://localhost/api/v1/commercial/opportunities/${sodCase.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SUBMIT" })
    });
    await postWorkflow(submitReq, { params: { id: sodCase.id } });

    // Attempt self-approval as creator with level 1 approver role
    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        id: requesterId,
        name: "Creator Requester",
        role: "COMMERCIAL_SUPERVISOR",
        permissions: ["precontract.workflow.approve"]
      }
    });

    const approveReq = new Request(`http://localhost/api/v1/commercial/opportunities/${sodCase.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "APPROVE", remarks: "Self approval attempt" })
    });

    const res = await postWorkflow(approveReq, { params: { id: sodCase.id } });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Segregation of Duties");

    // Clean up SoD test case
    await prisma.workflowActionHistory.deleteMany({ where: { instance: { referenceId: sodCase.id } } });
    await prisma.workflowInstance.deleteMany({ where: { referenceId: sodCase.id } });
    await prisma.preContractCase.delete({ where: { id: sodCase.id } });
  });

  it("21. Pipeline query returns correct Kanban breakdown across lifecycle stages", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request("http://localhost/api/v1/commercial/opportunities");
    const res = await getOpportunities(req);

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.pipeline).toBeDefined();
    expect(Array.isArray(json.pipeline.DRAFT)).toBe(true);
    expect(Array.isArray(json.pipeline.IN_WORKFLOW)).toBe(true);
    expect(Array.isArray(json.pipeline.COMPLETED)).toBe(true);
    expect(Array.isArray(json.pipeline.CANCELLED)).toBe(true);
  });
});
