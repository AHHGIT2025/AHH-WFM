import { prisma } from "@ahh-wfm/database";
import { GET as getCommandSummary } from "../../apps/web/app/api/v1/commercial/command-center/summary/route";
import { getServerSession } from "next-auth/next";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn()
}));

describe("Commercial Command Center — Phase CCC-1 API & Business Rules Suite", () => {
  const mockAdminUser = {
    id: "emp-admin-ccc1",
    name: "Command Center Admin",
    role: "SUPER_ADMIN",
    permissions: [
      "manpower.admin.full_access",
      "commercial.commandCenter.view",
      "commercial.commandCenter.crossCompany"
    ],
    operationAccess: {
      allowedSecurityGuarding: true,
      allowedFacilityManagement: true
    }
  };

  const mockSgUser = {
    id: "emp-sg-ccc1",
    name: "SG Coordinator",
    role: "SECURITY_ADMIN",
    companyId: "COMP-CCC-01",
    permissions: ["commercial.commandCenter.view", "manpower.security.view"],
    operationAccess: {
      allowedSecurityGuarding: true,
      allowedFacilityManagement: false
    }
  };

  const mockUnauthorizedUser = {
    id: "emp-user-no-ccc",
    name: "Regular Guard",
    role: "EMPLOYEE",
    permissions: ["self.profile.view"],
    operationAccess: {
      allowedSecurityGuarding: true,
      allowedFacilityManagement: false
    }
  };

  let testCompany: any;
  let testClient: any;
  let testContract: any;
  let testProject: any;
  let testSite: any;
  let testRequirement: any;
  let testSlot: any;

  beforeAll(async () => {
    // Setup test company and contract
    testCompany = await prisma.company.upsert({
      where: { id: "COMP-CCC-01" },
      update: {},
      create: {
        id: "COMP-CCC-01",
        companyCode: "CCC01",
        companyName: "CCC Test Operations Ltd"
      }
    });

    testClient = await prisma.manpowerClient.upsert({
      where: { id: "CLI-CCC-01" },
      update: {},
      create: {
        id: "CLI-CCC-01",
        operationType: "SECURITY_GUARDING",
        code: "CCC_CLI_01",
        name: "CCC Test Client"
      }
    });

    testContract = await prisma.manpowerContract.upsert({
      where: { id: "CON-CCC-01" },
      update: {},
      create: {
        id: "CON-CCC-01",
        operationType: "SECURITY_GUARDING",
        title: "CCC Test Security Contract",
        contractNumber: "CON-CCC-01",
        clientId: testClient.id,
        status: "ACTIVE",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31")
      }
    });

    testProject = await prisma.manpowerProject.upsert({
      where: { id: "PROJ-CCC-01" },
      update: {},
      create: {
        id: "PROJ-CCC-01",
        contractId: testContract.id,
        operationType: "SECURITY_GUARDING",
        code: "CCC_PROJ_01",
        name: "CCC Command Project Alpha"
      }
    });

    testSite = await prisma.manpowerSite.upsert({
      where: { id: "SITE-CCC-01" },
      update: {},
      create: {
        id: "SITE-CCC-01",
        projectId: testProject.id,
        operationType: "SECURITY_GUARDING",
        code: "CCC_SITE_01",
        name: "CCC Command Site Alpha"
      }
    });

    testRequirement = await prisma.contractManpowerRequirement.upsert({
      where: { id: "REQ-CCC-01" },
      update: {},
      create: {
        id: "REQ-CCC-01",
        contractId: testContract.id,
        position: "Security Guard",
        quantity: 1,
        deploymentType: "STANDARD"
      }
    });

    // Create a requirement slot for today
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    testSlot = await prisma.rosterRequirementSlot.create({
      data: {
        operationType: "SECURITY_GUARDING",
        companyId: testCompany.id,
        contractId: testContract.id,
        projectId: testProject.id,
        siteId: testSite.id,
        contractRequirementId: testRequirement.id,
        locationKey: `LOC:CCC:${testSite.id}`,
        sourceType: "CONTRACT_REQUIREMENT",
        sourceEffectiveFrom: new Date("2026-01-01"),
        businessDate: new Date(`${todayStr}T00:00:00Z`),
        shiftKey: "shift:DAY",
        slotIndex: 1,
        generationKey: `REQ_SLOT:CCC:${todayStr}:1`,
        snapshotPosition: "Security Guard",
        snapshotShiftName: "Day Shift",
        snapshotStartTime: "06:00",
        snapshotEndTime: "18:00",
        fulfillmentStatus: "VACANT"
      }
    });
  });

  afterAll(async () => {
    try {
      if (testSlot?.id) {
        await prisma.rosterRequirementSlot.deleteMany({ where: { id: testSlot.id } });
      }
      if (testRequirement?.id) {
        await prisma.contractManpowerRequirement.deleteMany({ where: { id: testRequirement.id } });
      }
      if (testSite?.id) {
        await prisma.manpowerSite.deleteMany({ where: { id: testSite.id } });
      }
      if (testProject?.id) {
        await prisma.manpowerProject.deleteMany({ where: { id: testProject.id } });
      }
      if (testContract?.id) {
        await prisma.manpowerContract.deleteMany({ where: { id: testContract.id } });
      }
      if (testClient?.id) {
        await prisma.manpowerClient.deleteMany({ where: { id: testClient.id } });
      }
      if (testCompany?.id) {
        await prisma.company.deleteMany({ where: { id: testCompany.id } });
      }
    } catch (e) {}
  });

  it("1. Authorized admin can fetch Command Center summary", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });

    const req = new Request("http://localhost/api/v1/commercial/command-center/summary");
    const res = await getCommandSummary(req);

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json).toHaveProperty("context");
    expect(json).toHaveProperty("operationalHealth");
    expect(json).toHaveProperty("manpowerCoverage");
    expect(json).toHaveProperty("attendance");
    expect(json).toHaveProperty("relieverReadiness");
    expect(json).toHaveProperty("exceptions");
    expect(json).toHaveProperty("contractExposure");
    expect(json).toHaveProperty("generatedAt");

    expect(["HEALTHY", "ATTENTION", "CRITICAL"]).toContain(json.operationalHealth.status);
    expect(typeof json.operationalHealth.score).toBe("number");
    expect(Array.isArray(json.operationalHealth.reasons)).toBe(true);
  });

  it("2. Unauthenticated request returns 401", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const req = new Request("http://localhost/api/v1/commercial/command-center/summary");
    const res = await getCommandSummary(req);

    expect(res.status).toBe(401);
  });

  it("3. Unauthorized user lacking permissions returns 403", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockUnauthorizedUser });

    const req = new Request("http://localhost/api/v1/commercial/command-center/summary");
    const res = await getCommandSummary(req);

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Forbidden");
  });

  it("4. SG user requesting FM operational data gets 403 scope isolation error", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockSgUser });

    const req = new Request("http://localhost/api/v1/commercial/command-center/summary?operationType=FACILITY_MANAGEMENT");
    const res = await getCommandSummary(req);

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Facility Management");
  });

  it("5. SG user can fetch Security Guarding summary with company isolation enforced", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockSgUser });

    const req = new Request("http://localhost/api/v1/commercial/command-center/summary?operationType=SECURITY_GUARDING");
    const res = await getCommandSummary(req);

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.context.operationType).toBe("SECURITY_GUARDING");
    expect(json.context.companyId).toBe("COMP-CCC-01");
  });

  it("6. Filters for specific contractId and siteId return valid structured data", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });

    const req = new Request(`http://localhost/api/v1/commercial/command-center/summary?contractId=${testContract.id}&siteId=${testSite.id}`);
    const res = await getCommandSummary(req);

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.context.contractId).toBe(testContract.id);
    expect(json.context.siteId).toBe(testSite.id);
    expect(json.manpowerCoverage.requiredManpower).toBeGreaterThanOrEqual(1);
  });
});
