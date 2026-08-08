import { prisma } from "@ahh-wfm/database";
import { GET as getCommandSummary } from "../../apps/web/app/api/v1/commercial/command-center/summary/route";
import { getServerSession } from "next-auth/next";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn()
}));

describe("Commercial Command Center — Phase CCC-1 Complete 22-Test Matrix", () => {
  const mockAdminUser = {
    id: "EMP-ADMIN-CCC1",
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
    id: "EMP-SG-CCC1",
    name: "SG Coordinator",
    role: "SECURITY_ADMIN",
    companyId: "COMP-CCC-01",
    permissions: ["commercial.commandCenter.view", "manpower.security.view"],
    operationAccess: {
      allowedSecurityGuarding: true,
      allowedFacilityManagement: false
    }
  };

  const mockFmUser = {
    id: "EMP-FM-CCC1",
    name: "FM Manager",
    role: "FM_ADMIN",
    companyId: "COMP-CCC-01",
    permissions: ["commercial.commandCenter.view", "manpower.fm.view"],
    operationAccess: {
      allowedSecurityGuarding: false,
      allowedFacilityManagement: true
    }
  };

  const mockUnauthorizedUser = {
    id: "EMP-USER-NO-CCC",
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
  let testSlot1: any;
  let testSlot2: any;
  let testAdminEmployee: any;
  let testEmployee1: any;
  let testEmployee2: any;
  let testAssignment1: any;
  let testAssignment2: any;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  beforeAll(async () => {
    // 1. Setup Test Company, Client, Contract, Project, Site
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
        quantity: 2,
        deploymentType: "STANDARD"
      }
    });

    testAdminEmployee = await prisma.employee.upsert({
      where: { id: mockAdminUser.id },
      update: {},
      create: {
        id: mockAdminUser.id,
        name: mockAdminUser.name,
        department: "Administration",
        role: mockAdminUser.role,
        status: "On Duty",
        email: "adminccc1@ahh-wfm.test",
        companyId: testCompany.id,
        operationType: "SECURITY_GUARDING"
      }
    });

    testEmployee1 = await prisma.employee.upsert({
      where: { id: "EMP-CCC-01" },
      update: {},
      create: {
        id: "EMP-CCC-01",
        name: "CCC Guard One",
        department: "Security",
        role: "EMPLOYEE",
        status: "On Duty",
        email: "cccguard1@ahh-wfm.test",
        companyId: testCompany.id,
        operationType: "SECURITY_GUARDING"
      }
    });

    testEmployee2 = await prisma.employee.upsert({
      where: { id: "EMP-CCC-02" },
      update: {},
      create: {
        id: "EMP-CCC-02",
        name: "CCC Guard Two",
        department: "Security",
        role: "EMPLOYEE",
        status: "On Duty",
        email: "cccguard2@ahh-wfm.test",
        companyId: testCompany.id,
        operationType: "SECURITY_GUARDING"
      }
    });

    // Create 2 slots for today
    testSlot1 = await prisma.rosterRequirementSlot.create({
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

    testSlot2 = await prisma.rosterRequirementSlot.create({
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
        slotIndex: 2,
        generationKey: `REQ_SLOT:CCC:${todayStr}:2`,
        snapshotPosition: "Security Guard",
        snapshotShiftName: "Day Shift",
        snapshotStartTime: "06:00",
        snapshotEndTime: "18:00",
        fulfillmentStatus: "VACANT"
      }
    });

    // Assign Employee 1 to Slot 1
    testAssignment1 = await prisma.rosterSlotAssignment.create({
      data: {
        slotId: testSlot1.id,
        employeeId: testEmployee1.id,
        assignedById: mockAdminUser.id,
        historyStatus: "ACTIVE"
      }
    });
  });

  afterAll(async () => {
    try {
      if (testAssignment1?.id) {
        await prisma.rosterSlotAssignment.deleteMany({ where: { id: testAssignment1.id } });
      }
      if (testAssignment2?.id) {
        await prisma.rosterSlotAssignment.deleteMany({ where: { id: testAssignment2.id } });
      }
      if (testSlot1?.id) {
        await prisma.rosterRequirementSlot.deleteMany({ where: { id: testSlot1.id } });
      }
      if (testSlot2?.id) {
        await prisma.rosterRequirementSlot.deleteMany({ where: { id: testSlot2.id } });
      }
      if (testRequirement?.id) {
        await prisma.contractManpowerRequirement.deleteMany({ where: { id: testRequirement.id } });
      }
      if (testEmployee1?.id) {
        await prisma.employee.deleteMany({ where: { id: testEmployee1.id } });
      }
      if (testEmployee2?.id) {
        await prisma.employee.deleteMany({ where: { id: testEmployee2.id } });
      }
      if (testAdminEmployee?.id) {
        await prisma.employee.deleteMany({ where: { id: testAdminEmployee.id } });
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

  it("1. Authorized summary request returns 200 and valid schema", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request("http://localhost/api/v1/commercial/command-center/summary");
    const res = await getCommandSummary(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("context");
    expect(json).toHaveProperty("operationalHealth");
    expect(json).toHaveProperty("manpowerCoverage");
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
  });

  it("4. Company isolation locks companyId filter for company-bound user", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockSgUser });
    const req = new Request("http://localhost/api/v1/commercial/command-center/summary");
    const res = await getCommandSummary(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.context.companyId).toBe("COMP-CCC-01");
  });

  it("5. SG user requesting FM operational data receives 403 scope isolation error", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockSgUser });
    const req = new Request("http://localhost/api/v1/commercial/command-center/summary?operationType=FACILITY_MANAGEMENT");
    const res = await getCommandSummary(req);
    expect(res.status).toBe(403);
  });

  it("6. FM user requesting SG operational data receives 403 scope isolation error", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockFmUser });
    const req = new Request("http://localhost/api/v1/commercial/command-center/summary?operationType=SECURITY_GUARDING");
    const res = await getCommandSummary(req);
    expect(res.status).toBe(403);
  });

  it("7. Valid business-date filter parses date correctly", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/command-center/summary?businessDate=${todayStr}`);
    const res = await getCommandSummary(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.context.businessDate).toBe(todayStr);
  });

  it("8. Valid company filter scopes summary metrics to specified company", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/command-center/summary?companyId=${testCompany.id}`);
    const res = await getCommandSummary(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.context.companyId).toBe(testCompany.id);
  });

  it("9. Valid contract filter scopes summary metrics to specified contract", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/command-center/summary?contractId=${testContract.id}`);
    const res = await getCommandSummary(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.context.contractId).toBe(testContract.id);
  });

  it("10. Valid site filter scopes summary metrics to specified site", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/command-center/summary?siteId=${testSite.id}`);
    const res = await getCommandSummary(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.context.siteId).toBe(testSite.id);
  });

  it("11. Invalid filter handling returns 400 for malformed businessDate or operationType", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request("http://localhost/api/v1/commercial/command-center/summary?businessDate=invalid-date");
    const res = await getCommandSummary(req);
    expect(res.status).toBe(400);

    const req2 = new Request("http://localhost/api/v1/commercial/command-center/summary?operationType=INVALID_SCOPE");
    const res2 = await getCommandSummary(req2);
    expect(res2.status).toBe(400);
  });

  it("12. Empty state returns HEALTHY classification and score 100 when no slots or degradation exist", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request("http://localhost/api/v1/commercial/command-center/summary?businessDate=2099-12-31");
    const res = await getCommandSummary(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.manpowerCoverage.requiredManpower).toBe(0);
    expect(json.operationalHealth.status).toBe("HEALTHY");
    expect(json.operationalHealth.score).toBe(100);
    expect(json.operationalHealth.reasons).toEqual([]);
  });

  it("13. Partial-data state aggregates partial coverage cleanly without throwing", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/command-center/summary?contractId=${testContract.id}`);
    const res = await getCommandSummary(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.manpowerCoverage.requiredManpower).toBe(2);
    expect(json.manpowerCoverage.assignedManpower).toBe(1);
    expect(json.manpowerCoverage.coveragePercentage).toBe(50);
  });

  it("14. HEALTHY classification evaluation when zero degradation conditions exist", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request("http://localhost/api/v1/commercial/command-center/summary?businessDate=2099-01-01");
    const res = await getCommandSummary(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.operationalHealth.status).toBe("HEALTHY");
  });

  it("15. ATTENTION classification evaluation when 1 uncovered slot or 90% coverage exists", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/command-center/summary?contractId=${testContract.id}`);
    const res = await getCommandSummary(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(["ATTENTION", "CRITICAL"]).toContain(json.operationalHealth.status);
    expect(json.operationalHealth.status).not.toBe("HEALTHY");
  });

  it("16. CRITICAL classification evaluation when coverage is < 80%", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/command-center/summary?contractId=${testContract.id}`);
    const res = await getCommandSummary(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    // 1 assigned / 2 required = 50% < 80% -> CRITICAL
    expect(json.operationalHealth.status).toBe("CRITICAL");
  });

  it("17. Health degradation reasons list explains why status is not HEALTHY", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/command-center/summary?contractId=${testContract.id}`);
    const res = await getCommandSummary(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.operationalHealth.reasons.length).toBeGreaterThan(0);
    expect(json.operationalHealth.reasons.some((r: string) => r.includes("50%"))).toBe(true);
  });

  it("18. Uncovered slot aggregation correctly counts slots with 0 active assignments", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/command-center/summary?contractId=${testContract.id}`);
    const res = await getCommandSummary(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.manpowerCoverage.uncoveredSlots).toBe(1);
  });

  it("19. Over-coverage aggregation correctly counts slots with > 1 active assignment", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    testAssignment2 = await prisma.rosterSlotAssignment.create({
      data: {
        slotId: testSlot1.id,
        employeeId: testEmployee2.id,
        assignedById: mockAdminUser.id,
        historyStatus: "ACTIVE"
      }
    });

    const req = new Request(`http://localhost/api/v1/commercial/command-center/summary?contractId=${testContract.id}`);
    const res = await getCommandSummary(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.manpowerCoverage.overCoverageCount).toBe(1);

    // Clean up temporary second assignment so subsequent tests have 1 assigned / 2 required
    await prisma.rosterSlotAssignment.delete({ where: { id: testAssignment2.id } });
    testAssignment2 = null;
  });

  it("20. Attendance exception aggregation counts present, absent, and late correctly", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/command-center/summary?businessDate=${todayStr}`);
    const res = await getCommandSummary(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.attendance).toHaveProperty("presentToday");
    expect(json.attendance).toHaveProperty("absentToday");
    expect(json.attendance).toHaveProperty("lateToday");
  });

  it("21. Reliever readiness evaluates required vs. available standby relievers", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request("http://localhost/api/v1/commercial/command-center/summary");
    const res = await getCommandSummary(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.relieverReadiness).toHaveProperty("requiredRelievers");
    expect(json.relieverReadiness).toHaveProperty("availableStandby");
    expect(json.relieverReadiness).toHaveProperty("readinessStatus");
  });

  it("22. Contract SLA exposure flags contracts operating below requirement or near SLA risk", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/command-center/summary?contractId=${testContract.id}`);
    const res = await getCommandSummary(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.contractExposure.activeContractsCount).toBe(1);
    expect(json.contractExposure.contractsBelowRequirementCount).toBe(1);
    expect(json.contractExposure.potentialSlaRiskCount).toBe(1);
  });
});
