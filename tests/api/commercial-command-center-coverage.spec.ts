import { prisma } from "@ahh-wfm/database";
import { GET as getRosterCoverage } from "../../apps/web/app/api/v1/commercial/command-center/roster-coverage/route";
import { getServerSession } from "next-auth/next";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn()
}));

describe("Commercial Command Center — Phase CCC-2 Roster Coverage & Reliever Readiness Suite", () => {
  const mockAdminUser = {
    id: "EMP-ADMIN-CCC2",
    name: "Command Center Coverage Admin",
    role: "SUPER_ADMIN",
    permissions: [
      "manpower.admin.full_access",
      "commercial.commandCenter.view",
      "commercial.commandCenter.rosterCoverage",
      "commercial.commandCenter.relieverReadiness"
    ],
    operationAccess: {
      allowedSecurityGuarding: true,
      allowedFacilityManagement: true
    }
  };

  const mockSgUser = {
    id: "EMP-SG-CCC2",
    name: "SG Coordinator",
    role: "SECURITY_ADMIN",
    companyId: "COMP-CCC-02",
    permissions: ["commercial.commandCenter.view", "commercial.commandCenter.rosterCoverage"],
    operationAccess: {
      allowedSecurityGuarding: true,
      allowedFacilityManagement: false
    }
  };

  const mockFmUser = {
    id: "EMP-FM-CCC2",
    name: "FM Manager",
    role: "FM_ADMIN",
    companyId: "COMP-CCC-02",
    permissions: ["commercial.commandCenter.view", "commercial.commandCenter.rosterCoverage"],
    operationAccess: {
      allowedSecurityGuarding: false,
      allowedFacilityManagement: true
    }
  };

  const mockSiteRestrictedSupervisor = {
    id: "EMP-SUP-CCC2",
    name: "Site Supervisor",
    role: "SECURITY_SUPERVISOR",
    companyId: "COMP-CCC-02",
    siteAccess: ["SITE-CCC-02A"],
    permissions: ["commercial.commandCenter.view", "commercial.commandCenter.rosterCoverage"],
    operationAccess: {
      allowedSecurityGuarding: true,
      allowedFacilityManagement: false
    }
  };

  const mockUnauthorizedUser = {
    id: "EMP-USER-NO-CCC2",
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
  let testSiteA: any;
  let testSiteB: any;
  let testRequirement: any;
  let testSlot1: any;
  let testSlot2: any;
  let testSlotCancelled: any;
  let testAdminEmployee: any;
  let testEmployee1: any;
  let testEmployee2: any;
  let testAssignment1: any;
  let testAssignment2: any;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  beforeAll(async () => {
    // 1. Setup Test Master Models
    testCompany = await prisma.company.upsert({
      where: { id: "COMP-CCC-02" },
      update: {},
      create: {
        id: "COMP-CCC-02",
        companyCode: "CCC02",
        companyName: "CCC Coverage Test Ltd"
      }
    });

    testClient = await prisma.manpowerClient.upsert({
      where: { id: "CLI-CCC-02" },
      update: {},
      create: {
        id: "CLI-CCC-02",
        operationType: "SECURITY_GUARDING",
        code: "CCC_CLI_02",
        name: "CCC Coverage Client"
      }
    });

    testContract = await prisma.manpowerContract.upsert({
      where: { id: "CON-CCC-02" },
      update: {},
      create: {
        id: "CON-CCC-02",
        operationType: "SECURITY_GUARDING",
        title: "CCC Roster Coverage Contract",
        contractNumber: "CON-CCC-02",
        clientId: testClient.id,
        status: "ACTIVE",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31")
      }
    });

    testProject = await prisma.manpowerProject.upsert({
      where: { id: "PROJ-CCC-02" },
      update: {},
      create: {
        id: "PROJ-CCC-02",
        contractId: testContract.id,
        operationType: "SECURITY_GUARDING",
        code: "CCC_PROJ_02",
        name: "CCC Coverage Project Beta"
      }
    });

    testSiteA = await prisma.manpowerSite.upsert({
      where: { id: "SITE-CCC-02A" },
      update: {},
      create: {
        id: "SITE-CCC-02A",
        projectId: testProject.id,
        operationType: "SECURITY_GUARDING",
        code: "CCC_SITE_02A",
        name: "CCC Site Alpha"
      }
    });

    testSiteB = await prisma.manpowerSite.upsert({
      where: { id: "SITE-CCC-02B" },
      update: {},
      create: {
        id: "SITE-CCC-02B",
        projectId: testProject.id,
        operationType: "SECURITY_GUARDING",
        code: "CCC_SITE_02B",
        name: "CCC Site Beta"
      }
    });

    testRequirement = await prisma.contractManpowerRequirement.upsert({
      where: { id: "REQ-CCC-02" },
      update: {},
      create: {
        id: "REQ-CCC-02",
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
        email: "adminccc2@ahh-wfm.test",
        companyId: testCompany.id,
        operationType: "SECURITY_GUARDING"
      }
    });

    testEmployee1 = await prisma.employee.upsert({
      where: { id: "EMP-CCC-02A" },
      update: {},
      create: {
        id: "EMP-CCC-02A",
        name: "Coverage Guard One",
        department: "Security",
        role: "EMPLOYEE",
        status: "On Duty",
        email: "coverage1@ahh-wfm.test",
        companyId: testCompany.id,
        operationType: "SECURITY_GUARDING"
      }
    });

    testEmployee2 = await prisma.employee.upsert({
      where: { id: "EMP-CCC-02B" },
      update: {},
      create: {
        id: "EMP-CCC-02B",
        name: "Coverage Guard Two",
        department: "Security",
        role: "EMPLOYEE",
        status: "On Duty",
        email: "coverage2@ahh-wfm.test",
        companyId: testCompany.id,
        operationType: "SECURITY_GUARDING"
      }
    });

    // 2. Create Requirement Slots
    testSlot1 = await prisma.rosterRequirementSlot.create({
      data: {
        operationType: "SECURITY_GUARDING",
        companyId: testCompany.id,
        contractId: testContract.id,
        projectId: testProject.id,
        siteId: testSiteA.id,
        contractRequirementId: testRequirement.id,
        locationKey: `LOC:CCC:${testSiteA.id}`,
        sourceType: "CONTRACT_REQUIREMENT",
        sourceEffectiveFrom: new Date("2026-01-01"),
        businessDate: new Date(`${todayStr}T00:00:00Z`),
        shiftKey: "shift:DAY",
        slotIndex: 1,
        generationKey: `REQ_SLOT:CCC2:${todayStr}:1`,
        snapshotPosition: "Security Guard",
        snapshotShiftName: "Day Shift",
        snapshotStartTime: "06:00",
        snapshotEndTime: "18:00",
        fulfillmentStatus: "VACANT",
        scheduleStatus: "ACTIVE"
      }
    });

    testSlot2 = await prisma.rosterRequirementSlot.create({
      data: {
        operationType: "SECURITY_GUARDING",
        companyId: testCompany.id,
        contractId: testContract.id,
        projectId: testProject.id,
        siteId: testSiteB.id,
        contractRequirementId: testRequirement.id,
        locationKey: `LOC:CCC:${testSiteB.id}`,
        sourceType: "CONTRACT_REQUIREMENT",
        sourceEffectiveFrom: new Date("2026-01-01"),
        businessDate: new Date(`${todayStr}T00:00:00Z`),
        shiftKey: "shift:NIGHT",
        slotIndex: 1,
        generationKey: `REQ_SLOT:CCC2:${todayStr}:2`,
        snapshotPosition: "Security Guard",
        snapshotShiftName: "Night Shift",
        snapshotStartTime: "18:00",
        snapshotEndTime: "06:00",
        fulfillmentStatus: "VACANT",
        scheduleStatus: "ACTIVE"
      }
    });

    testSlotCancelled = await prisma.rosterRequirementSlot.create({
      data: {
        operationType: "SECURITY_GUARDING",
        companyId: testCompany.id,
        contractId: testContract.id,
        projectId: testProject.id,
        siteId: testSiteA.id,
        contractRequirementId: testRequirement.id,
        locationKey: `LOC:CCC:${testSiteA.id}`,
        sourceType: "CONTRACT_REQUIREMENT",
        sourceEffectiveFrom: new Date("2026-01-01"),
        businessDate: new Date(`${todayStr}T00:00:00Z`),
        shiftKey: "shift:DAY",
        slotIndex: 99,
        generationKey: `REQ_SLOT:CCC2:${todayStr}:CANCELLED`,
        snapshotPosition: "Security Guard",
        snapshotShiftName: "Day Shift",
        snapshotStartTime: "06:00",
        snapshotEndTime: "18:00",
        fulfillmentStatus: "CANCELLED",
        scheduleStatus: "CANCELLED"
      }
    });

    // Assign Employee 1 to Slot 1 (Filled Slot)
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
      if (testSlotCancelled?.id) {
        await prisma.rosterRequirementSlot.deleteMany({ where: { id: testSlotCancelled.id } });
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
      if (testSiteA?.id) {
        await prisma.manpowerSite.deleteMany({ where: { id: testSiteA.id } });
      }
      if (testSiteB?.id) {
        await prisma.manpowerSite.deleteMany({ where: { id: testSiteB.id } });
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

  it("1. Authorized request returns 200 with summary, items, and hierarchy", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/command-center/roster-coverage?contractId=${testContract.id}`);
    const res = await getRosterCoverage(req);

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json).toHaveProperty("context");
    expect(json).toHaveProperty("summary");
    expect(json).toHaveProperty("items");
    expect(json).toHaveProperty("hierarchy");
    expect(json.summary.totalRequiredSlots).toBe(2);
    expect(json.summary.filledSlotsCount).toBe(1);
    expect(json.summary.uncoveredSlotsCount).toBe(1);
    expect(json.summary.coveragePercentage).toBe(50);
  });

  it("2. Unauthenticated request returns 401", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const req = new Request("http://localhost/api/v1/commercial/command-center/roster-coverage");
    const res = await getRosterCoverage(req);
    expect(res.status).toBe(401);
  });

  it("3. Unauthorized user returns 403", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockUnauthorizedUser });
    const req = new Request("http://localhost/api/v1/commercial/command-center/roster-coverage");
    const res = await getRosterCoverage(req);
    expect(res.status).toBe(403);
  });

  it("4. Company isolation locks companyId filter for company-bound user", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockSgUser });
    const req = new Request("http://localhost/api/v1/commercial/command-center/roster-coverage");
    const res = await getRosterCoverage(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.context.companyId).toBe("COMP-CCC-02");
  });

  it("5. SG user requesting FM operational data gets 403 scope isolation error", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockSgUser });
    const req = new Request("http://localhost/api/v1/commercial/command-center/roster-coverage?operationType=FACILITY_MANAGEMENT");
    const res = await getRosterCoverage(req);
    expect(res.status).toBe(403);
  });

  it("6. FM user requesting SG operational data gets 403 scope isolation error", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockFmUser });
    const req = new Request("http://localhost/api/v1/commercial/command-center/roster-coverage?operationType=SECURITY_GUARDING");
    const res = await getRosterCoverage(req);
    expect(res.status).toBe(403);
  });

  it("7. Site/Project restricted supervisor sees only authorized sites", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockSiteRestrictedSupervisor });
    const req = new Request(`http://localhost/api/v1/commercial/command-center/roster-coverage?contractId=${testContract.id}`);
    const res = await getRosterCoverage(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.context.scopeIsolation.siteRestricted).toBe(true);
    expect(json.items.length).toBe(1);
    expect(json.items[0].siteId).toBe(testSiteA.id);
  });

  it("8. Inactive / cancelled requirement slots are excluded from active count", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/command-center/roster-coverage?contractId=${testContract.id}`);
    const res = await getRosterCoverage(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.summary.totalRequiredSlots).toBe(2);
    expect(json.items.some((i: any) => i.slotId === testSlotCancelled.id)).toBe(false);
  });

  it("9. Filter by siteId returns site-specific slots", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/command-center/roster-coverage?siteId=${testSiteB.id}`);
    const res = await getRosterCoverage(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.items.length).toBe(1);
    expect(json.items[0].siteId).toBe(testSiteB.id);
    expect(json.items[0].coverageStatus).toBe("UNCOVERED");
  });

  it("10. Filter by locationKey returns location-specific slots", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/command-center/roster-coverage?locationKey=LOC:CCC:${testSiteA.id}`);
    const res = await getRosterCoverage(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.items.length).toBe(1);
    expect(json.items[0].locationKey).toBe(`LOC:CCC:${testSiteA.id}`);
  });

  it("11. Filter by shiftKey returns shift-specific slots", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/command-center/roster-coverage?shiftKey=shift:NIGHT`);
    const res = await getRosterCoverage(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.items.length).toBe(1);
    expect(json.items[0].shiftKey).toBe("shift:NIGHT");
  });

  it("12. Filter by coverageStatus=UNCOVERED returns only uncovered slots", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/command-center/roster-coverage?contractId=${testContract.id}&coverageStatus=UNCOVERED`);
    const res = await getRosterCoverage(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.items.length).toBe(1);
    expect(json.items[0].coverageStatus).toBe("UNCOVERED");
  });

  it("13. Over-coverage aggregation correctly flags slots with > 1 active assignment", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    testAssignment2 = await prisma.rosterSlotAssignment.create({
      data: {
        slotId: testSlot1.id,
        employeeId: testEmployee2.id,
        assignedById: mockAdminUser.id,
        historyStatus: "ACTIVE"
      }
    });

    const req = new Request(`http://localhost/api/v1/commercial/command-center/roster-coverage?contractId=${testContract.id}`);
    const res = await getRosterCoverage(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.summary.overCoveredSlotsCount).toBe(1);

    // Clean up temporary second assignment
    await prisma.rosterSlotAssignment.delete({ where: { id: testAssignment2.id } });
    testAssignment2 = null;
  });

  it("14. Empty state returns 0 required slots and 100% coverage on date with no requirements", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request("http://localhost/api/v1/commercial/command-center/roster-coverage?businessDate=2099-12-31");
    const res = await getRosterCoverage(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.summary.totalRequiredSlots).toBe(0);
    expect(json.summary.coveragePercentage).toBe(100);
    expect(json.items).toEqual([]);
    expect(json.hierarchy).toEqual([]);
  });

  it("15. Reliever readiness summary aggregates required, assigned, and standby relievers", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request("http://localhost/api/v1/commercial/command-center/roster-coverage");
    const res = await getRosterCoverage(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.summary.relieverReadiness).toHaveProperty("requiredRelieversCount");
    expect(json.summary.relieverReadiness).toHaveProperty("assignedRelieversCount");
    expect(json.summary.relieverReadiness).toHaveProperty("availableStandbyRelieversCount");
    expect(json.summary.relieverReadiness).toHaveProperty("overallReadinessStatus");
    expect(Array.isArray(json.summary.relieverReadiness.readinessReasons)).toBe(true);
  });

  it("16. Authoritative drill-down links are properly generated", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: mockAdminUser });
    const req = new Request(`http://localhost/api/v1/commercial/command-center/roster-coverage?contractId=${testContract.id}`);
    const res = await getRosterCoverage(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    const firstItem = json.items[0];
    expect(firstItem).toHaveProperty("drillDownLinks");
    expect(firstItem.drillDownLinks.rosterPlanner).toContain("/manpower/security-guarding/deployment-calendar");
    expect(firstItem.drillDownLinks.reconciliation).toBe("/manpower/security-guarding/reconciliation");
    expect(firstItem.drillDownLinks.workforceProfile).toBe("/workforce");
  });
});
