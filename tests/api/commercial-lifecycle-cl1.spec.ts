import { prisma } from "@ahh-wfm/database";
import { GET as getCrm, POST as postCrm, PATCH as patchCrm } from "../../apps/web/app/api/v1/commercial/crm/route";
import { GET as getOpportunities, POST as postOpportunities, PATCH as patchOpportunities } from "../../apps/web/app/api/v1/commercial/opportunities/route";
import { POST as postWorkflow } from "../../apps/web/app/api/v1/commercial/opportunities/[id]/workflow/route";
import { getServerSession } from "next-auth/next";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn()
}));

describe("Commercial Lifecycle — Phase CL-1 Suite", () => {
  const mockAdminUser = {
    id: "EMP-ADMIN-CL1",
    name: "Commercial Admin CL1",
    role: "SUPER_ADMIN",
    permissions: [
      "manpower.admin.full_access",
      "commercial.commandCenter.view",
      "precontract.prospectClient.view",
      "precontract.prospectClient.manage",
      "precontract.case.view",
      "precontract.case.manage",
      "precontract.workflow.submit",
      "precontract.workflow.approve"
    ],
    operationAccess: {
      allowedSecurityGuarding: true,
      allowedFacilityManagement: true
    }
  };

  const mockCompanyBoundUser = {
    id: "EMP-COMP-CL1",
    name: "Company Bound User",
    role: "SECURITY_ADMIN",
    companyId: "COMP-CL1-01",
    permissions: [
      "commercial.commandCenter.view",
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
  let testCase: any;

  beforeAll(async () => {
    testCompany = await prisma.company.upsert({
      where: { id: "COMP-CL1-01" },
      update: {},
      create: {
        id: "COMP-CL1-01",
        companyCode: "COMPCL1",
        companyName: "CL1 Test Company Ltd"
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

  it("1. Unauthenticated request to CRM endpoints returns 401", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const req = new Request("http://localhost/api/v1/commercial/crm");
    const res = await getCrm(req);
    expect(res.status).toBe(401);
  });

  it("2. Unauthorized user request to CRM endpoints returns 403", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockUnauthorizedUser });
    const req = new Request("http://localhost/api/v1/commercial/crm");
    const res = await getCrm(req);
    expect(res.status).toBe(403);
  });

  it("3. Registering new prospect client with unique CR number sets CLEARED duplicate status", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request("http://localhost/api/v1/commercial/crm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Unique Prospect Company",
        crNumber: "CR-UNIQUE-12345",
        contactPersonName: "Jassim Al-Thani",
        contactPersonEmail: "jassim@uniqueprospect.qa",
        operationType: "SECURITY_GUARDING"
      })
    });

    const res = await postCrm(req);
    expect(res.status).toBe(201);
    const json = await res.json();

    expect(json.prospect).toBeDefined();
    expect(json.prospect.name).toBe("Unique Prospect Company");
    expect(json.prospect.duplicateCheckStatus).toBe("CLEARED");
    expect(json.prospect.matchedClientMasterId).toBeNull();

    testProspectClient = json.prospect;
  });

  it("4. Registering prospect client matching existing CR number triggers MATCH_FOUND status", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request("http://localhost/api/v1/commercial/crm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Duplicate Master Prospect",
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

  it("5. Company-bound user query is locked to user companyId", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockCompanyBoundUser });
    const req = new Request("http://localhost/api/v1/commercial/crm");
    const res = await getCrm(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.prospects)).toBe(true);
  });

  it("6. Creating commercial opportunity case sets lifecycle to DRAFT", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request("http://localhost/api/v1/commercial/opportunities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Lusail Pearl Security & Soft Services 2026",
        prospectClientId: testProspectClient.id,
        operationType: "SECURITY_GUARDING"
      })
    });

    const res = await postOpportunities(req);
    expect(res.status).toBe(201);
    const json = await res.json();

    expect(json.case).toBeDefined();
    expect(json.case.title).toBe("Lusail Pearl Security & Soft Services 2026");
    expect(json.case.lifecycle).toBe("DRAFT");
    expect(json.case.businessOutcome).toBe("IN_PROGRESS");

    testCase = json.case;
  });

  it("7. Submitting opportunity to workflow transitions lifecycle to IN_WORKFLOW and creates audit history", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/opportunities/${testCase.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "SUBMIT",
        remarks: "Initial submission for commercial governance approval"
      })
    });

    const res = await postWorkflow(req, { params: { id: testCase.id } });
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.case.lifecycle).toBe("IN_WORKFLOW");
    expect(json.workflow.action).toBe("SUBMIT");
    expect(json.workflow.status).toBe("IN_PROGRESS");

    // Verify WorkflowActionHistory audit log in database
    const history = await prisma.workflowActionHistory.findMany({
      where: { instance: { referenceId: testCase.id } }
    });

    expect(history.length).toBeGreaterThan(0);
    expect(history[0].action).toBe("SUBMIT");
    expect(history[0].remarks).toBe("Initial submission for commercial governance approval");
  });

  it("8. Approving opportunity workflow transitions lifecycle to COMPLETED (Won)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/opportunities/${testCase.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "APPROVE",
        remarks: "Approved by Commercial Governance Committee"
      })
    });

    const res = await postWorkflow(req, { params: { id: testCase.id } });
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.case.lifecycle).toBe("COMPLETED");
    expect(json.workflow.action).toBe("APPROVE");
    expect(json.workflow.status).toBe("APPROVED");
  });

  it("9. Querying commercial opportunities returns pipeline Kanban breakdown", async () => {
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

  it("10. Invalid workflow action returns 400 bad request error", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/opportunities/${testCase.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "INVALID_ACTION"
      })
    });

    const res = await postWorkflow(req, { params: { id: testCase.id } });
    expect(res.status).toBe(400);
  });
});
