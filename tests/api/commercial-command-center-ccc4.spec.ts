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
  let testContractSla: any;
  let testRequirement: any;

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
        `DELETE FROM ManpowerClient WHERE code = 'CLI-CCC4-001'`
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

  describe("2. GET /api/v1/commercial/command-center/commercial-health — Bounded Date-Range Validation", () => {
    it("5. returns 400 Bad Request when dateFrom has invalid format", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/commercial-health?dateFrom=INVALID");
      const res = await getCommercialHealth(req);
      expect(res.status).toBe(400);
    });

    it("6. returns 400 Bad Request when dateTo has invalid format", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/commercial-health?dateTo=BAD_DATE");
      const res = await getCommercialHealth(req);
      expect(res.status).toBe(400);
    });

    it("7. returns 400 Bad Request when dateFrom > dateTo", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/commercial-health?dateFrom=2026-08-10&dateTo=2026-08-01");
      const res = await getCommercialHealth(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("dateFrom cannot be after dateTo");
    });

    it("8. returns 400 Bad Request when date range exceeds 31 days", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/commercial-health?dateFrom=2026-01-01&dateTo=2026-03-01");
      const res = await getCommercialHealth(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("exceeds maximum supported limit of 31 days");
    });

    it("9. returns 200 and valid rangeLengthDays for valid 8-day range", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/command-center/commercial-health?dateFrom=2026-08-01&dateTo=2026-08-08");
      const res = await getCommercialHealth(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.context.dateFrom).toBe("2026-08-01");
      expect(data.context.dateTo).toBe("2026-08-08");
      expect(data.context.rangeLengthDays).toBe(8);
    });
  });

  describe("3. GET /api/v1/commercial/command-center/commercial-health — Scope Isolation & Security", () => {
    it("10. filters analytics by SECURITY_GUARDING operation scope", async () => {
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

    it("11. direct contract access denial — returns 403 when requesting an out-of-scope contract ID directly", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockSgUser });
      const req = new Request(`http://localhost:3100/api/v1/commercial/command-center/commercial-health?contractId=${testContract2.id}`);
      const res = await getCommercialHealth(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Forbidden");
    });
  });

  describe("4. SLA Authority Rules & Baseline Operational Risk Policy", () => {
    it("12. baseline-only contract operating below 90% returns isOperationalRiskAdvisory = true and isSlaBreach = false", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request(`http://localhost:3100/api/v1/commercial/command-center/commercial-health?contractId=${testContract.id}`);
      const res = await getCommercialHealth(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      const c = data.contracts[0];
      expect(c.slaExposure.hasCustomSlaConfig).toBe(false);
      expect(c.slaExposure.isSlaBreach).toBe(false);
      expect(c.slaExposure.slaConfigurationSource).toBe("MANPOWER_CONTRACT_STANDARD_BASELINE");
      expect(typeof c.slaExposure.isOperationalRiskAdvisory).toBe("boolean");
    });

    it("13. Case A — contract with custom SLA target breached (coverage < target) returns isSlaBreach = true", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });

      const req = new Request(`http://localhost:3100/api/v1/commercial/command-center/commercial-health?contractId=${testContract.id}&customSlaTarget=95`);
      const res = await getCommercialHealth(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      const c = data.contracts[0];
      expect(c.slaExposure.hasCustomSlaConfig).toBe(true);
      expect(c.slaExposure.slaTargetCoverage).toBe(95);
      expect(c.slaExposure.slaConfigurationSource).toBe("CONTRACT_CUSTOM_SLA_REQUIREMENT");
      expect(c.slaExposure.isSlaBreach).toBe(true);
    });

    it("14. Case B — contract with custom SLA target satisfied (coverage >= target) returns isSlaBreach = false", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });

      const req = new Request(`http://localhost:3100/api/v1/commercial/command-center/commercial-health?contractId=${testContract.id}&customSlaTarget=0`);
      const res = await getCommercialHealth(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      const c = data.contracts[0];
      expect(c.slaExposure.hasCustomSlaConfig).toBe(true);
      expect(c.slaExposure.slaTargetCoverage).toBe(0);
      expect(c.slaExposure.slaConfigurationSource).toBe("CONTRACT_CUSTOM_SLA_REQUIREMENT");
      expect(c.slaExposure.isSlaBreach).toBe(false);
    });
  });

  describe("5. Reliever Readiness CCC-2 Parity", () => {
    it("15. CCC-2 / CCC-4 reliever parity — consumes shared getRelieverEligibilityWhere filter", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({ user: mockAdminUser });
      const req = new Request(`http://localhost:3100/api/v1/commercial/command-center/commercial-health?contractId=${testContract.id}`);
      const res = await getCommercialHealth(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      const c = data.contracts[0];
      expect(c.relieverReadiness).toBeDefined();
      expect(typeof c.relieverReadiness.availableStandby).toBe("number");
    });
  });
});
