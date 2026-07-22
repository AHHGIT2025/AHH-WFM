import { validateContractPayload } from "../../packages/mock-data/src/index";
import { mockDb, isDbConnected } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { POST as requestFoc } from "../../apps/web/app/api/v1/manpower/contracts/requirements/[id]/foc-request/route";
import { POST as evaluateFoc } from "../../apps/web/app/api/v1/manpower/contracts/requirements/[id]/foc-evaluate/route";
import { POST as revokeFoc } from "../../apps/web/app/api/v1/manpower/contracts/requirements/[id]/foc-revoke/route";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn()
}));

describe("Manpower Planning Phase MP-1 Contract & FOC Validation Test Suite", () => {
  let mockClient: any;
  let mockContract: any;
  let mockRequirement: any;
  let mockMaker: any;
  let mockChecker: any;
  let mockSite: any;

  beforeAll(async () => {
    // Initialize mock database seeds if DB is connected
    const connected = await isDbConnected();
    if (connected) {
      // Clean previous tests
      await prisma.userActivityLog.deleteMany({
        where: { action: { in: ["CONTRACT_FOC_REQUEST", "CONTRACT_FOC_APPROVE", "CONTRACT_FOC_REJECT", "CONTRACT_FOC_REVOKE"] } }
      });

      // Find or create test entities
      mockClient = await prisma.manpowerClient.findFirst();
      if (!mockClient) {
        mockClient = await (prisma.manpowerClient.create as any)({
          data: { name: "MP-1 Test Client", code: "TCL-001", operationType: "SECURITY_GUARDING", isActive: true }
        });
      }

      mockSite = await prisma.manpowerSite.findFirst();
      if (!mockSite) {
        const proj = await (prisma.manpowerProject.create as any)({
          data: {
            clientId: mockClient.id,
            name: "MP-1 Test Project",
            code: "TPR-001",
            operationType: "SECURITY_GUARDING",
            isActive: true
          }
        });
        mockSite = await prisma.manpowerSite.create({
          data: {
            projectId: proj.id,
            name: "MP-1 Test Site",
            code: "TSI-001",
            operationType: "SECURITY_GUARDING",
            isActive: true
          }
        });
      }

      mockMaker = await prisma.employee.findFirst({ where: { role: "SECURITY_ADMIN", isActive: true } });
      if (!mockMaker) {
        mockMaker = await (prisma.employee.create as any)({
          data: {
            id: "emp-maker-test-01",
            name: "Test Maker",
            email: "maker@test.com",
            role: "SECURITY_ADMIN",
            department: "Operations",
            status: "Offline",
            isActive: true
          }
        });
      }

      mockChecker = await prisma.employee.findFirst({
        where: { role: "SECURITY_ADMIN", isActive: true, id: { not: mockMaker.id } }
      });
      if (!mockChecker) {
        mockChecker = await (prisma.employee.create as any)({
          data: {
            id: "emp-checker-test-02",
            name: "Test Checker",
            email: "checker@test.com",
            role: "SECURITY_ADMIN",
            department: "Operations",
            status: "Offline",
            isActive: true
          }
        });
      }
    } else {
      // Mock for in-memory testing
      mockClient = { id: "c-1", name: "Mock Client" };
      mockSite = { id: "s-1", name: "Mock Site" };
      mockMaker = { id: "emp-maker", role: "SECURITY_ADMIN", isActive: true };
      mockChecker = { id: "emp-checker", role: "SECURITY_ADMIN", isActive: true };
    }
  });

  beforeEach(async () => {
    // Reset/create standard draft contract and requirement for each test
    const contractData = {
      clientId: mockClient.id,
      title: "FOC Roster Test Contract",
      contractType: "PERMANENT",
      operationType: "SECURITY_GUARDING",
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      manpowerRequirements: [
        {
          position: "Guard",
          quantity: 2,
          deploymentType: "Permanent",
          unitPrice: 1500,
          billingFrequency: "Monthly",
          billingPeriodCount: 1,
          isFoc: false,
          remarks: "Requirement Test"
        }
      ]
    };

    mockContract = await mockDb.createManpowerContract(contractData);
    mockRequirement = mockContract.manpowerRequirements[0];
  });

  describe("1. Contract Payload Validation Rules", () => {
    it("rejects invalid contractType options", () => {
      expect(() => {
        validateContractPayload({ contractType: "INVALID_TYPE" });
      }).toThrow("Invalid contract type");
    });

    it("requires serviceStartAt and serviceEndAt for Temporary/Event contracts", () => {
      expect(() => {
        validateContractPayload({ contractType: "TEMPORARY" });
      }).toThrow("Service start and end date-times are required");
    });

    it("enforces start < end service dates", () => {
      expect(() => {
        validateContractPayload({
          contractType: "TEMPORARY",
          serviceStartAt: "2026-07-22T10:00:00.000Z",
          serviceEndAt: "2026-07-22T09:00:00.000Z",
          siteId: mockSite.id,
          billingBasis: "HOURLY"
        });
      }).toThrow("Service end date-time must be after");
    });

    it("enforces XOR constraint on siteId and eventVenue", () => {
      // Both supplied
      expect(() => {
        validateContractPayload({
          contractType: "EVENT",
          serviceStartAt: "2026-07-22T10:00:00.000Z",
          serviceEndAt: "2026-07-22T18:00:00.000Z",
          siteId: mockSite.id,
          eventVenue: "Grand Ballroom",
          billingBasis: "DAILY"
        });
      }).toThrow("Exactly one of Worksite or External Venue");

      // Neither supplied
      expect(() => {
        validateContractPayload({
          contractType: "EVENT",
          serviceStartAt: "2026-07-22T10:00:00.000Z",
          serviceEndAt: "2026-07-22T18:00:00.000Z",
          billingBasis: "DAILY"
        });
      }).toThrow("Exactly one of Worksite or External Venue");
    });

    it("requires billingBasis for temporary/event contracts", () => {
      expect(() => {
        validateContractPayload({
          contractType: "TEMPORARY",
          serviceStartAt: "2026-07-22T10:00:00.000Z",
          serviceEndAt: "2026-07-22T18:00:00.000Z",
          siteId: mockSite.id
        });
      }).toThrow("Billing basis is required");
    });

    it("derives startDate and endDate (midnight UTC) from service timestamps", () => {
      const payload: any = {
        contractType: "EVENT",
        serviceStartAt: "2026-07-22T10:30:00.000Z",
        serviceEndAt: "2026-07-23T18:00:00.000Z",
        eventVenue: "Grand Ballroom",
        billingBasis: "DAILY"
      };
      validateContractPayload(payload);
      expect(payload.startDate).toBe("2026-07-22T00:00:00.000Z");
      expect(payload.endDate).toBe("2026-07-23T00:00:00.000Z");
    });

    it("derives startDate and endDate using Qatar timezone (Asia/Qatar) business-time boundary", () => {
      const payload: any = {
        contractType: "EVENT",
        serviceStartAt: "2026-07-21T22:30:00.000Z", // 2026-07-22 01:30:00 AM Qatar time
        serviceEndAt: "2026-07-22T22:30:00.000Z", // 2026-07-23 01:30:00 AM Qatar time
        eventVenue: "Grand Ballroom",
        billingBasis: "DAILY"
      };
      validateContractPayload(payload);
      expect(payload.startDate).toBe("2026-07-22T00:00:00.000Z"); // Derived as July 22nd
      expect(payload.endDate).toBe("2026-07-23T00:00:00.000Z"); // Derived as July 23rd
    });
  });

  describe("2. FOC Maker-Checker Lifecycle Actions", () => {
    it("FOC request validation and transitions", async () => {
      // Mock session for Maker
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: mockMaker.id,
          role: "SECURITY_ADMIN",
          permissions: ["manpower.security.contracts.manage"],
          operationAccess: { allowedSecurityGuarding: true }
        }
      });

      // 1. Missing reason must throw 400
      const reqNoReason = new Request("http://localhost/foc-request", {
        method: "POST",
        body: JSON.stringify({})
      });
      let res = await requestFoc(reqNoReason, { params: { id: mockRequirement.id } });
      expect(res.status).toBe(400);

      // 2. Successful FOC request
      const reqSuccess = new Request("http://localhost/foc-request", {
        method: "POST",
        body: JSON.stringify({ reason: "Sponsor promotion FOC line" })
      });
      res = await requestFoc(reqSuccess, { params: { id: mockRequirement.id } });
      expect(res.status).toBe(200);

      const requirement = await res.json();
      expect(requirement.focStatus).toBe("PENDING_APPROVAL");
      expect(requirement.billingEligible).toBe(false);
      expect(requirement.preFocUnitPrice).toBe(1500);
      expect(requirement.preFocLineTotal).toBe(3000);
    });

    it("blocks self-approval maker-checker checks", async () => {
      // Request FOC first to set the correct state and maker ID
      await mockDb.updateContractManpowerRequirement(mockRequirement.id, {
        focStatus: "PENDING_APPROVAL",
        focRequestedById: mockMaker.id,
        preFocUnitPrice: 1500,
        preFocLineTotal: 3000
      });

      // Mock session for Checker to be same as Maker
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: mockMaker.id,
          role: "SECURITY_ADMIN",
          permissions: ["manpower.security.contracts.foc_approve"],
          operationAccess: { allowedSecurityGuarding: true }
        }
      });

      // Attempt self-approval
      const reqEval = new Request("http://localhost/foc-evaluate", {
        method: "POST",
        body: JSON.stringify({ action: "APPROVE", reason: "Approved self" })
      });
      const res = await evaluateFoc(reqEval, { params: { id: mockRequirement.id } });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe("Self-approval is prohibited");
    });

    it("approves FOC line successfully, forcing price to zero", async () => {
      // Request FOC first
      await mockDb.updateContractManpowerRequirement(mockRequirement.id, {
        focStatus: "PENDING_APPROVAL",
        focRequestedById: mockMaker.id,
        preFocUnitPrice: 1500,
        preFocLineTotal: 3000
      });

      // Mock session for Checker
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: mockChecker.id,
          role: "SECURITY_ADMIN",
          permissions: ["manpower.security.contracts.foc_approve"],
          operationAccess: { allowedSecurityGuarding: true }
        }
      });

      const reqEval = new Request("http://localhost/foc-evaluate", {
        method: "POST",
        body: JSON.stringify({ action: "APPROVE", reason: "Contract campaign approved" })
      });
      const res = await evaluateFoc(reqEval, { params: { id: mockRequirement.id } });
      expect(res.status).toBe(200);

      const requirement = await res.json();
      expect(requirement.focStatus).toBe("APPROVED");
      expect(requirement.unitPrice).toBe(0);
      expect(requirement.lineTotal).toBe(0);
      expect(requirement.billingEligible).toBe(false);
    });

    it("rejects FOC line and restores original pricing", async () => {
      // Request FOC first
      await mockDb.updateContractManpowerRequirement(mockRequirement.id, {
        focStatus: "PENDING_APPROVAL",
        focRequestedById: mockMaker.id,
        preFocUnitPrice: 1500,
        preFocLineTotal: 3000
      });

      // Mock session for Checker
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: mockChecker.id,
          role: "SECURITY_ADMIN",
          permissions: ["manpower.security.contracts.foc_approve"],
          operationAccess: { allowedSecurityGuarding: true }
        }
      });

      const reqEval = new Request("http://localhost/foc-evaluate", {
        method: "POST",
        body: JSON.stringify({ action: "REJECT", reason: "Standard pricing applies" })
      });
      const res = await evaluateFoc(reqEval, { params: { id: mockRequirement.id } });
      expect(res.status).toBe(200);

      const requirement = await res.json();
      expect(requirement.focStatus).toBe("REJECTED");
      expect(requirement.unitPrice).toBe(1500);
      expect(requirement.lineTotal).toBe(3000);
      expect(requirement.billingEligible).toBe(true);
    });

    it("revokes approved FOC line, keeping rates disabled until re-entry", async () => {
      // Set to APPROVED
      await mockDb.updateContractManpowerRequirement(mockRequirement.id, {
        focStatus: "APPROVED",
        focRequestedById: mockMaker.id,
        focApprovedById: mockChecker.id,
        unitPrice: 0,
        lineTotal: 0,
        preFocUnitPrice: 1500,
        preFocLineTotal: 3000
      });

      // Mock session for Checker
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: mockChecker.id,
          role: "SECURITY_ADMIN",
          permissions: ["manpower.security.contracts.foc_approve"],
          operationAccess: { allowedSecurityGuarding: true }
        }
      });

      const reqRevoke = new Request("http://localhost/foc-revoke", {
        method: "POST",
        body: JSON.stringify({ reason: "Campaign cancelled prematurely" })
      });
      const res = await revokeFoc(reqRevoke, { params: { id: mockRequirement.id } });
      expect(res.status).toBe(200);

      const requirement = await res.json();
      expect(requirement.focStatus).toBe("REVOKED");
      expect(requirement.unitPrice).toBe(0); // Kept at zero as per business rule (re-entry needed)
      expect(requirement.billingEligible).toBe(false);
    });
  });

  describe("3. Regression Fix: Requirement Grids for Security & FM", () => {
    it("persists manpower, reliever, and shift requirements for both Security and FM", async () => {
      // 1. Create a SECURITY_GUARDING contract with requirement lists
      const sgContractPayload = {
        clientId: mockClient?.id || "temp-client-id",
        title: "Test Security Contract with Reqs",
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        status: "DRAFT",
        operationType: "SECURITY_GUARDING",
        contractType: "PERMANENT",
        manpowerRequirements: [
          { position: "Security Guard", quantity: 5, unitPrice: 1500, billingFrequency: "Monthly", billingPeriodCount: 1 }
        ],
        relieverRequirements: [
          { position: "Reliever Guard", quantity: 1, sourcePreference: "General Pool" }
        ],
        shiftRequirements: [
          { shiftName: "Day Shift", startTime: "07:00", endTime: "19:00", postsCovered: 5, daysPattern: "Daily" }
        ]
      };

      const sgContract = await mockDb.createManpowerContract(sgContractPayload);
      expect(sgContract.id).toBeDefined();
      expect(sgContract.manpowerRequirements).toHaveLength(1);
      expect(sgContract.manpowerRequirements[0].position).toBe("Security Guard");
      expect(sgContract.relieverRequirements).toHaveLength(1);
      expect(sgContract.relieverRequirements[0].position).toBe("Reliever Guard");
      expect(sgContract.shiftRequirements).toHaveLength(1);
      expect(sgContract.shiftRequirements[0].shiftName).toBe("Day Shift");

      // 2. Create a FACILITY_MANAGEMENT contract with requirement lists
      // Create FM Client if not exists
      let fmClient = await prisma.manpowerClient.findFirst({ where: { operationType: "FACILITY_MANAGEMENT" } });
      if (!fmClient && await isDbConnected()) {
        fmClient = await (prisma.manpowerClient.create as any)({
          data: { name: "MP-1 FM Client", code: "TCL-FM-01", operationType: "FACILITY_MANAGEMENT", isActive: true }
        });
      }

      const fmContractPayload = {
        clientId: fmClient?.id || "temp-fm-client-id",
        title: "Test FM Contract with Reqs",
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        status: "DRAFT",
        operationType: "FACILITY_MANAGEMENT",
        contractType: "PERMANENT",
        manpowerRequirements: [
          { position: "FM Technician", quantity: 3, unitPrice: 2000, billingFrequency: "Monthly", billingPeriodCount: 1 }
        ],
        relieverRequirements: [
          { position: "FM Reliever Technician", quantity: 1, sourcePreference: "General Pool" }
        ],
        shiftRequirements: [
          { shiftName: "Day Shift", startTime: "08:00", endTime: "17:00", postsCovered: 3, daysPattern: "Daily" }
        ]
      };

      const fmContract = await mockDb.createManpowerContract(fmContractPayload);
      expect(fmContract.id).toBeDefined();
      expect(fmContract.manpowerRequirements).toHaveLength(1);
      expect(fmContract.manpowerRequirements[0].position).toBe("FM Technician");
      expect(fmContract.relieverRequirements).toHaveLength(1);
      expect(fmContract.relieverRequirements[0].position).toBe("FM Reliever Technician");
      expect(fmContract.shiftRequirements).toHaveLength(1);
      expect(fmContract.shiftRequirements[0].shiftName).toBe("Day Shift");
    });

    it("verifies partial updates preserve existing requirements unless explicitly overwritten", async () => {
      // 1. Create a contract with manpower requirement
      const contract = await mockDb.createManpowerContract({
        clientId: mockClient.id,
        title: "Partial Update Preservation Test",
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        status: "DRAFT",
        operationType: "SECURITY_GUARDING",
        contractType: "PERMANENT",
        manpowerRequirements: [
          { position: "Security Guard", quantity: 2, unitPrice: 1500, billingFrequency: "Monthly", billingPeriodCount: 1 }
        ]
      });

      // 2. Perform partial update (data.manpowerRequirements is undefined)
      const updated = await mockDb.updateManpowerContract(contract.id, {
        title: "Partial Update Preservation Test Updated",
        status: "DRAFT"
        // manpowerRequirements is omitted
      });

      // 3. Confirm requirement record is still present!
      const fetched = await mockDb.getManpowerContract(contract.id);
      expect(fetched.title).toBe("Partial Update Preservation Test Updated");
      expect(fetched.manpowerRequirements).toHaveLength(1);
      expect(fetched.manpowerRequirements[0].position).toBe("Security Guard");
    });

    it("verifies security and FM scope isolation logic", async () => {
      // Create SECURITY_GUARDING and FACILITY_MANAGEMENT contracts
      const sgContract = await mockDb.createManpowerContract({
        clientId: mockClient.id,
        title: "SG Isolated Contract",
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        status: "DRAFT",
        operationType: "SECURITY_GUARDING"
      });

      let fmClient = await prisma.manpowerClient.findFirst({ where: { operationType: "FACILITY_MANAGEMENT" } });
      if (!fmClient && await isDbConnected()) {
        fmClient = await (prisma.manpowerClient.create as any)({
          data: { name: "MP-1 FM Client Scope", code: "TCL-FM-02", operationType: "FACILITY_MANAGEMENT", isActive: true }
        });
      }

      const fmContract = await mockDb.createManpowerContract({
        clientId: fmClient?.id || "temp-fm-client-id-2",
        title: "FM Isolated Contract",
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        status: "DRAFT",
        operationType: "FACILITY_MANAGEMENT"
      });

      // Fetch by scope
      const sgContractsList = await mockDb.getManpowerContracts("SECURITY_GUARDING");
      const fmContractsList = await mockDb.getManpowerContracts("FACILITY_MANAGEMENT");

      expect(sgContractsList.some((c: any) => c.id === sgContract.id)).toBe(true);
      expect(sgContractsList.some((c: any) => c.id === fmContract.id)).toBe(false);

      expect(fmContractsList.some((c: any) => c.id === fmContract.id)).toBe(true);
      expect(fmContractsList.some((c: any) => c.id === sgContract.id)).toBe(false);
    });

    it("verifies that Overnight Shift start and end times format validation works", async () => {
      const payload: any = {
        contractType: "EVENT",
        serviceStartAt: "2026-07-22T19:00:00.000Z", // Starts evening
        serviceEndAt: "2026-07-23T07:00:00.000Z", // Ends next morning
        eventVenue: "Ballroom B",
        billingBasis: "HOURLY"
      };
      // Validation should execute successfully since start < end
      expect(() => validateContractPayload(payload)).not.toThrow();
    });

    it("verifies validation of contract status workflows (Draft/Active/Addendum setup)", async () => {
      const contract = await mockDb.createManpowerContract({
        clientId: mockClient.id,
        title: "Status Workflow Contract",
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        status: "DRAFT",
        operationType: "SECURITY_GUARDING",
        contractType: "PERMANENT"
      });

      expect(contract.status).toBe("DRAFT");

      // Verify that active/approved contracts cannot be edited directly via updateManpowerContract
      await mockDb.updateManpowerContract(contract.id, {
        status: "ACTIVE"
      });

      const updated = await mockDb.getManpowerContract(contract.id);
      expect(updated.status).toBe("ACTIVE");

      // Attempting to update an ACTIVE contract direct payload should throw an error
      await expect(
        mockDb.updateManpowerContract(contract.id, {
          title: "Direct Edit Attempt"
        })
      ).rejects.toThrow("Only draft or rejected contracts can be edited");
    });
  });
});
