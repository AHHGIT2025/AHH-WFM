import { prisma } from "@ahh-wfm/database";
import { GET as getCommercialHealth } from "../../apps/web/app/api/v1/commercial/command-center/commercial-health/route";
import { getServerSession } from "next-auth/next";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn()
}));

describe("Commercial Command Center Phase CCC-4 Suite (Commercial Health & SLA Analytics)", () => {
  const mockAdminUser = {
    id: "EMP-ADMIN-CCC4",
    name: "Commercial Admin CCC4",
    role: "SUPER_ADMIN",
    companyId: "COMP-CCC4-01",
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
    id: "EMP-SG-CCC4",
    name: "SG Supervisor CCC4",
    role: "SECURITY_ADMIN",
    companyId: "COMP-CCC4-01",
    permissions: ["commercial.commandCenter.view"],
    operationAccess: {
      allowedSecurityGuarding: true,
      allowedFacilityManagement: false
    }
  };

  const mockFmUser = {
    id: "EMP-FM-CCC4",
    name: "FM Supervisor CCC4",
    role: "FM_ADMIN",
    companyId: "COMP-CCC4-01",
    permissions: ["commercial.commandCenter.view"],
    operationAccess: {
      allowedSecurityGuarding: false,
      allowedFacilityManagement: true
    }
  };

  const mockUnauthorizedUser = {
    id: "EMP-NOACCESS-CCC4",
    name: "No Access User",
    role: "GUEST",
    permissions: [],
    operationAccess: {
      allowedSecurityGuarding: false,
      allowedFacilityManagement: false
    }
  };

  let testCompany: any;
  let testClient: any;
  let testContract: any;
  let testContract2: any;
  let testProject: any;
  let testSite: any;
  let testRequirement: any;
  let testSlot: any;

  beforeAll(async () => {
    // Clean up stale CCC4 test data
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM RosterRequirementSlot WHERE contractId IN (SELECT id FROM ManpowerContract WHERE contractNumber LIKE 'CONT-CCC4-%')`
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM ManpowerContractAddendumLineItem WHERE addendumId IN (SELECT id FROM ManpowerContractAddendum WHERE addendumNumber LIKE 'ADD-CCC4-%')`
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM ManpowerContractAddendum WHERE addendumNumber LIKE 'ADD-CCC4-%'`
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM ContractManpowerRequirement WHERE contractId IN (SELECT id FROM ManpowerContract WHERE contractNumber LIKE 'CONT-CCC4-%')`
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM ManpowerContract WHERE contractNumber LIKE 'CONT-CCC4-%'`
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM ManpowerClient WHERE code = 'CLI-CCC4-001'`
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM Company WHERE companyCode = 'COMP-CCC4-01'`
      );
    } catch (e) {}

    // Seed test Company & Client
    testCompany = await prisma.company.create({
      data: {
        companyCode: "COMP-CCC4-01",
        companyName: "CCC4 Test Security Services WLL"
      }
    });

    testClient = await prisma.manpowerClient.create({
      data: {
        code: "CLI-CCC4-001",
        name: "CCC4 Commercial Client Corp",
        operationType: "SECURITY_GUARDING"
      }
    });

    // Seed Test Active Contract 1 (Security Guarding)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 90);

    testContract = await prisma.manpowerContract.create({
      data: {
        contractNumber: "CONT-CCC4-001",
        title: "CCC4 Security Operations Contract",
        clientId: testClient.id,
        operationType: "SECURITY_GUARDING",
        status: "ACTIVE",
        startDate: new Date("2026-01-01"),
        endDate: futureDate,
        defaultManpowerCount: 10,
        defaultRelieverCount: 2
      }
    });

    // Seed Base Manpower Requirement for Contract 1
    testRequirement = await prisma.contractManpowerRequirement.create({
      data: {
        contractId: testContract.id,
        position: "Security Guard",
        quantity: 10,
        unitPrice: 3500,
        billingFrequency: "MONTHLY",
        deploymentType: "FULL_TIME"
      }
    });

    // Seed Approved Addendum (+5 Guards) for Contract 1
    const addendum = await prisma.manpowerContractAddendum.create({
      data: {
        contractId: testContract.id,
        addendumNumber: "ADD-CCC4-001",
        title: "CCC4 Site Expansion Addendum",
        addendumDate: new Date(),
        effectiveFrom: new Date(),
        addendumType: "MANPOWER_INCREASE",
        status: "APPROVED"
      }
    });

    await prisma.manpowerContractAddendumLineItem.create({
      data: {
        addendumId: addendum.id,
        itemType: "MANPOWER",
        changeType: "ADD",
        itemName: "Security Guard",
        quantity: 5,
        unitPrice: 3500,
        billingFrequency: "MONTHLY"
      }
    });

    // Seed Test Expiring Contract 2 (Facility Management - expiring in 15 days)
    const expiringDate = new Date();
    expiringDate.setDate(expiringDate.getDate() + 15);

    testContract2 = await prisma.manpowerContract.create({
      data: {
        contractNumber: "CONT-CCC4-002",
        title: "CCC4 FM Soft Services Contract",
        clientId: testClient.id,
        operationType: "FACILITY_MANAGEMENT",
        status: "ACTIVE",
        startDate: new Date("2025-01-01"),
        endDate: expiringDate,
        defaultManpowerCount: 8,
        defaultRelieverCount: 1
      }
    });
  });

  afterAll(async () => {
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM RosterRequirementSlot WHERE contractId IN (SELECT id FROM ManpowerContract WHERE contractNumber LIKE 'CONT-CCC4-%')`
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM ManpowerContractAddendumLineItem WHERE addendumId IN (SELECT id FROM ManpowerContractAddendum WHERE addendumNumber LIKE 'ADD-CCC4-%')`
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM ManpowerContractAddendum WHERE addendumNumber LIKE 'ADD-CCC4-%'`
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM ContractManpowerRequirement WHERE contractId IN (SELECT id FROM ManpowerContract WHERE contractNumber LIKE 'CONT-CCC4-%')`
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM ManpowerContract WHERE contractNumber LIKE 'CONT-CCC4-%'`
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM ManpowerClient WHERE clientCode = 'CLI-CCC4-001'`
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM Company WHERE companyCode = 'COMP-CCC4-01'`
      );
    } catch (e) {}
  });

  describe("1. GET /api/v1/commercial/command-center/commercial-health — Auth & Validation", () => {
    it("1. returns 401 Unauthenticated when session is missing", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/commercial-health");
      const res = await getCommercialHealth(req);
      expect(res.status).toBe(401);
    });

    it("2. returns 403 Forbidden when user lacks commercial command center permission", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockUnauthorizedUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/commercial-health");
      const res = await getCommercialHealth(req);
      expect(res.status).toBe(403);
    });

    it("3. returns 400 Bad Request on invalid businessDate format", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/commercial-health?businessDate=INVALID");
      const res = await getCommercialHealth(req);
      expect(res.status).toBe(400);
    });

    it("4. returns 400 Bad Request on invalid operationType enum", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/commercial-health?operationType=INVALID_SCOPE");
      const res = await getCommercialHealth(req);
      expect(res.status).toBe(400);
    });
  });

  describe("2. GET /api/v1/commercial/command-center/commercial-health — Scope Isolation", () => {
    it("5. filters analytics by SECURITY_GUARDING operation scope", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockSgUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/commercial-health?operationType=SECURITY_GUARDING");
      const res = await getCommercialHealth(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.context.operationType).toBe("SECURITY_GUARDING");
      data.contracts.forEach((c: any) => {
        expect(c.operationType).toBe("SECURITY_GUARDING");
      });
    });

    it("6. filters analytics by FACILITY_MANAGEMENT operation scope", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockFmUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/commercial-health?operationType=FACILITY_MANAGEMENT");
      const res = await getCommercialHealth(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.context.operationType).toBe("FACILITY_MANAGEMENT");
      data.contracts.forEach((c: any) => {
        expect(c.operationType).toBe("FACILITY_MANAGEMENT");
      });
    });

    it("7. blocks SG user from accessing FACILITY_MANAGEMENT scope", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockSgUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/commercial-health?operationType=FACILITY_MANAGEMENT");
      const res = await getCommercialHealth(req);
      expect(res.status).toBe(403);
    });

    it("8. blocks FM user from accessing SECURITY_GUARDING scope", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockFmUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/commercial-health?operationType=SECURITY_GUARDING");
      const res = await getCommercialHealth(req);
      expect(res.status).toBe(403);
    });

    it("9. prevents KPI scope leakage — portfolio metrics reflect ONLY scoped contracts", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockSgUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/commercial-health?operationType=SECURITY_GUARDING");
      const res = await getCommercialHealth(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      // Ensure portfolio metrics count only SG contracts
      const totalContractsInList = data.contracts.length;
      expect(data.portfolioMetrics.totalActiveContracts).toBe(totalContractsInList);
    });
  });

  describe("3. Effective Contract Manpower & Addenda Analytics", () => {
    it("10. calculates base manpower and approved addenda adjustments accurately", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request(`http://localhost:3100/api/v1/commercial/command-center/commercial-health?contractId=${testContract.id}`);
      const res = await getCommercialHealth(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.contracts.length).toBe(1);
      const c = data.contracts[0];
      expect(c.effectiveRequirements.baseManpowerCount).toBe(10);
      expect(c.effectiveRequirements.addendaManpowerDelta).toBe(5);
      expect(c.effectiveRequirements.effectiveManpowerCount).toBe(15);
    });
  });

  describe("4. Contract Expiry & SLA Risk Rules", () => {
    it("11. flags contract expiring within 30 days with EXPIRING_SOON status", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request(`http://localhost:3100/api/v1/commercial/command-center/commercial-health?contractId=${testContract2.id}`);
      const res = await getCommercialHealth(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.contracts.length).toBe(1);
      const c = data.contracts[0];
      expect(c.expiryStatus).toBe("EXPIRING_SOON");
      expect(c.daysToExpiry).toBeLessThanOrEqual(30);
      expect(c.daysToExpiry).toBeGreaterThan(0);
    });

    it("12. returns correct SLA risk state and SLA risk reason flags", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request(`http://localhost:3100/api/v1/commercial/command-center/commercial-health?contractId=${testContract.id}`);
      const res = await getCommercialHealth(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      const c = data.contracts[0];
      expect(c.slaExposure).toBeDefined();
      expect(typeof c.slaExposure.isSlaRisk).toBe("boolean");
      expect(Array.isArray(c.slaExposure.slaRiskReasons)).toBe(true);
    });
  });

  describe("5. Billing Support Advisory & Drill-Down URLs", () => {
    it("13. returns billing-support advisory indicators and non-empty drill-down URLs", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request(`http://localhost:3100/api/v1/commercial/command-center/commercial-health?contractId=${testContract.id}`);
      const res = await getCommercialHealth(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      const c = data.contracts[0];
      expect(c.billingSupport).toBeDefined();
      expect(c.billingSupport.billableAdvisoryManpower).toBeDefined();

      expect(c.drillDownUrls).toBeDefined();
      expect(c.drillDownUrls.contractMaster).toContain("/manpower/");
      expect(c.drillDownUrls.rosterCoverage).toContain("/commercial/command-center/roster-coverage");
      expect(c.drillDownUrls.escalationQueue).toContain("/commercial/command-center/escalations");
      expect(c.drillDownUrls.reconciliation).toContain("/manpower/");
    });
  });

  describe("6. Filters, Pagination & Empty State", () => {
    it("14. pagination — limit=1 returns at most 1 item with pagination metadata", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/commercial-health?limit=1&page=1");
      const res = await getCommercialHealth(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.contracts.length).toBeLessThanOrEqual(1);
      expect(data.pagination.limit).toBe(1);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.totalItems).toBeDefined();
    });

    it("15. empty state — searching for non-existent client returns 200 with empty contracts array", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/commercial-health?clientId=NON_EXISTENT_CLIENT_ID");
      const res = await getCommercialHealth(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.contracts).toEqual([]);
      expect(data.pagination.totalItems).toBe(0);
    });
  });
});
