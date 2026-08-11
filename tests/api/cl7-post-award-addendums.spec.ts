import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { NextRequest } from "next/server";

import { GET as getAddendums, POST as createAddendum } from "../../apps/web/app/api/v1/commercial/contracts/[contractId]/addendums/route";
import { POST as approveAddendum } from "../../apps/web/app/api/v1/commercial/contracts/[contractId]/addendums/[addendumId]/approve/route";
import { POST as terminateContract } from "../../apps/web/app/api/v1/commercial/contracts/[contractId]/terminate/route";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn()
}));

describe("Commercial Lifecycle Phase CL-7: Post-Award Addendums & Amendments API Suite", () => {
  let testCompanyId: string;
  let testClientId: string;
  let testActiveContractId: string;
  let testDraftContractId: string;
  let testAddendumId: string;

  beforeAll(async () => {
    const rand = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    const company = await prisma.company.create({
      data: {
        companyCode: `CC7-${rand}`,
        companyName: `CL-7 Test Company ${rand}`,
        isActive: true
      }
    });
    testCompanyId = company.id;

    const client = await prisma.manpowerClient.create({
      data: {
        code: `CLIC7-${rand}`,
        name: `CL7 Test Client ${rand}`,
        operationType: "SECURITY_GUARDING",
        isActive: true
      }
    });
    testClientId = client.id;

    // Create ACTIVE contract (eligible for addendums)
    const activeContract = await prisma.manpowerContract.create({
      data: {
        clientId: testClientId,
        contractNumber: `CONC7-ACT-${rand}`,
        title: "CL-7 Active Test Contract",
        startDate: new Date("2026-09-01"),
        endDate: new Date("2027-08-31"),
        operationType: "SECURITY_GUARDING",
        status: "ACTIVE",
        approvalStatus: "APPROVED",
        mobilisationStatus: "MOBILISED"
      }
    });
    testActiveContractId = activeContract.id;

    // Create DRAFT contract (ineligible for addendums)
    const draftContract = await prisma.manpowerContract.create({
      data: {
        clientId: testClientId,
        contractNumber: `CONC7-DRF-${rand}`,
        title: "CL-7 Draft Test Contract",
        startDate: new Date("2026-09-01"),
        endDate: new Date("2027-08-31"),
        operationType: "SECURITY_GUARDING",
        status: "DRAFT",
        approvalStatus: "PENDING",
        mobilisationStatus: "PENDING"
      }
    });
    testDraftContractId = draftContract.id;
  });

  afterAll(async () => {
    // Clean up created records
    if (testActiveContractId) {
      await prisma.manpowerContractAddendumLineItem.deleteMany({ where: { addendum: { contractId: testActiveContractId } } });
      await prisma.manpowerContractAddendum.deleteMany({ where: { contractId: testActiveContractId } });
      await prisma.manpowerContract.deleteMany({ where: { id: testActiveContractId } });
    }
    if (testDraftContractId) {
      await prisma.manpowerContract.deleteMany({ where: { id: testDraftContractId } });
    }
    if (testClientId) {
      await prisma.manpowerClient.deleteMany({ where: { id: testClientId } });
    }
    if (testCompanyId) {
      await prisma.company.deleteMany({ where: { id: testCompanyId } });
    }
  });

  describe("GET /api/v1/commercial/contracts/[contractId]/addendums", () => {
    it("should return 401 if unauthenticated", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);

      const req = new NextRequest(`http://localhost:3100/api/v1/commercial/contracts/${testActiveContractId}/addendums`);
      const res = await getAddendums(req, { params: { contractId: testActiveContractId } });
      expect(res.status).toBe(401);
    });

    it("should return contract addendums for authorized users", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: "emp-admin-cl7",
          role: "SUPER_ADMIN",
          companyId: testCompanyId,
          permissions: ["commercial.addendum.view"]
        }
      });

      const req = new NextRequest(`http://localhost:3100/api/v1/commercial/contracts/${testActiveContractId}/addendums`);
      const res = await getAddendums(req, { params: { contractId: testActiveContractId } });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.contract.status).toBe("ACTIVE");
      expect(Array.isArray(data.addendums)).toBe(true);
    });
  });

  describe("POST /api/v1/commercial/contracts/[contractId]/addendums (Business Rule Checks)", () => {
    it("should reject addendum creation for non-ACTIVE contract status", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: "emp-admin-cl7",
          role: "SUPER_ADMIN",
          companyId: testCompanyId,
          permissions: ["commercial.addendum.manage"]
        }
      });

      const req = new NextRequest(
        `http://localhost:3100/api/v1/commercial/contracts/${testDraftContractId}/addendums`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Draft Addendum Attempt",
            addendumType: "SCOPE_CHANGE",
            effectiveFrom: "2026-09-01"
          })
        }
      );

      const res = await createAddendum(req, { params: { contractId: testDraftContractId } });
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error).toContain("only permitted for ACTIVE contracts");
    });

    it("should create addendum for ACTIVE contract", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: "emp-admin-cl7",
          role: "SUPER_ADMIN",
          companyId: testCompanyId,
          permissions: ["commercial.addendum.manage"]
        }
      });

      const req = new NextRequest(
        `http://localhost:3100/api/v1/commercial/contracts/${testActiveContractId}/addendums`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "West Wing Headcount Expansion",
            addendumType: "SCOPE_CHANGE",
            effectiveFrom: "2026-09-01",
            effectiveTo: "2027-12-31",
            description: "Addition of 4 Senior Security Guards for West Wing Perimeter",
            calculatedCommercialImpact: 45000,
            lineItems: [
              {
                itemType: "MANPOWER",
                changeType: "ADD",
                itemName: "Senior Security Guard",
                quantity: 4,
                unitPrice: 3500,
                billingFrequency: "MONTHLY",
                lineTotal: 14000
              }
            ]
          })
        }
      );

      const res = await createAddendum(req, { params: { contractId: testActiveContractId } });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.addendum.status).toBe("DRAFT");
      expect(data.addendum.lineItems.length).toBe(1);

      testAddendumId = data.addendum.id;
    });
  });

  describe("POST /api/v1/commercial/contracts/[contractId]/addendums/[addendumId]/approve", () => {
    it("should approve addendum and update contract effective end date atomically", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: "emp-admin-cl7",
          role: "SUPER_ADMIN",
          companyId: testCompanyId,
          permissions: ["commercial.addendum.manage"]
        }
      });

      const req = new NextRequest(
        `http://localhost:3100/api/v1/commercial/contracts/${testActiveContractId}/addendums/${testAddendumId}/approve`,
        { method: "POST" }
      );

      const res = await approveAddendum(req, { params: { contractId: testActiveContractId, addendumId: testAddendumId } });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.alreadyApproved).toBe(false);
      expect(data.addendum.status).toBe("APPROVED");
    });

    it("should be idempotent on repeated approve calls", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: "emp-admin-cl7",
          role: "SUPER_ADMIN",
          companyId: testCompanyId,
          permissions: ["commercial.addendum.manage"]
        }
      });

      const req = new NextRequest(
        `http://localhost:3100/api/v1/commercial/contracts/${testActiveContractId}/addendums/${testAddendumId}/approve`,
        { method: "POST" }
      );

      const res = await approveAddendum(req, { params: { contractId: testActiveContractId, addendumId: testAddendumId } });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.alreadyApproved).toBe(true);
    });
  });

  describe("POST /api/v1/commercial/contracts/[contractId]/terminate", () => {
    it("should terminate active contract and update status to TERMINATED", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: "emp-admin-cl7",
          role: "SUPER_ADMIN",
          companyId: testCompanyId,
          permissions: ["commercial.contract.terminate"]
        }
      });

      const req = new NextRequest(
        `http://localhost:3100/api/v1/commercial/contracts/${testActiveContractId}/terminate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            terminationReason: "Mutual Commercial Settlement upon Project Completion",
            settlementNotes: "All final invoices cleared."
          })
        }
      );

      const res = await terminateContract(req, { params: { contractId: testActiveContractId } });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.contractStatus).toBe("TERMINATED");
    });
  });
});
