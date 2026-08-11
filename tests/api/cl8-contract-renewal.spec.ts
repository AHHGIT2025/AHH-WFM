import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { NextRequest } from "next/server";

import { GET as getRenewals, POST as initiateRenewal } from "../../apps/web/app/api/v1/commercial/renewals/route";
import { POST as processDecision } from "../../apps/web/app/api/v1/commercial/renewals/[caseId]/decision/route";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn()
}));

describe("Commercial Lifecycle Phase CL-8: Contract Renewal & Expiry Management API Suite", () => {
  let testCompanyId: string;
  let testClientId: string;
  let testActiveContractId: string;
  let testAddendumId: string;
  let testWorkflowTemplateId: string;
  let testRenewalCaseId: string;
  let testDraftContractId: string;

  beforeAll(async () => {
    const rand = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    // Create central workflow template for CONTRACT_RENEWAL under Settings > Workflow Setup
    const template = await prisma.workflowTemplate.create({
      data: {
        workflowName: `CL8 Central Renewal Workflow ${rand}`,
        moduleType: "CONTRACT_RENEWAL",
        appliesTo: "ACTIVATION",
        isDefault: true,
        isActive: true
      }
    });
    testWorkflowTemplateId = template.id;

    const company = await prisma.company.create({
      data: {
        companyCode: `CC8-${rand}`,
        companyName: `CL-8 Test Company ${rand}`,
        isActive: true
      }
    });
    testCompanyId = company.id;

    const client = await prisma.manpowerClient.create({
      data: {
        code: `CLIC8-${rand}`,
        name: `CL8 Test Client ${rand}`,
        operationType: "SECURITY_GUARDING",
        isActive: true
      }
    });
    testClientId = client.id;

    // Create ACTIVE contract expiring soon with noticePeriodDays = 60
    const activeContract = await prisma.manpowerContract.create({
      data: {
        clientId: testClientId,
        contractNumber: `CONC8-ACT-${rand}`,
        title: "CL-8 Active Test Contract",
        startDate: new Date("2025-09-01"),
        endDate: new Date("2026-08-31"),
        totalContractValue: 120000,
        operationType: "SECURITY_GUARDING",
        status: "ACTIVE",
        approvalStatus: "APPROVED",
        mobilisationStatus: "MOBILISED",
        noticePeriodDays: 60,
        currency: "QAR",
        billingBasis: "MONTHLY",
        manpowerRequirements: {
          create: [
            {
              position: "Security Officer",
              quantity: 5,
              deploymentType: "REGULAR",
              unitPrice: 3500
            }
          ]
        }
      }
    });
    testActiveContractId = activeContract.id;

    // Create approved CL-7 Addendum to test requirement delta baseline preservation
    const addendum = await prisma.manpowerContractAddendum.create({
      data: {
        contractId: testActiveContractId,
        addendumNumber: `${activeContract.contractNumber}-ADD-01`,
        title: "CL-7 Headcount Expansion",
        addendumDate: new Date(),
        effectiveFrom: new Date("2026-01-01"),
        addendumType: "SCOPE_CHANGE",
        status: "APPROVED",
        calculatedCommercialImpact: 24000,
        lineItems: {
          create: [
            {
              itemType: "MANPOWER",
              changeType: "ADD",
              itemName: "Senior Guard",
              quantity: 2,
              unitPrice: 4000,
              billingFrequency: "MONTHLY",
              lineTotal: 8000
            }
          ]
        }
      }
    });
    testAddendumId = addendum.id;
  });

  afterAll(async () => {
    // Clean up created records in foreign key order
    if (testWorkflowTemplateId) {
      await prisma.workflowActionHistory.deleteMany({ where: { instance: { templateId: testWorkflowTemplateId } } });
      await prisma.workflowInstance.deleteMany({ where: { templateId: testWorkflowTemplateId } });
      await prisma.workflowTemplate.deleteMany({ where: { id: testWorkflowTemplateId } });
    }
    if (testDraftContractId) {
      await prisma.contractManpowerRequirement.deleteMany({ where: { contractId: testDraftContractId } });
      await prisma.manpowerContract.deleteMany({ where: { id: testDraftContractId } });
    }
    if (testActiveContractId) {
      await prisma.manpowerContractRenewalCase.deleteMany({ where: { contractId: testActiveContractId } });
      await prisma.manpowerContractAddendumLineItem.deleteMany({ where: { addendum: { contractId: testActiveContractId } } });
      await prisma.manpowerContractAddendum.deleteMany({ where: { contractId: testActiveContractId } });
      await prisma.contractManpowerRequirement.deleteMany({ where: { contractId: testActiveContractId } });
      await prisma.manpowerContract.deleteMany({ where: { id: testActiveContractId } });
    }
    if (testClientId) {
      await prisma.manpowerClient.deleteMany({ where: { id: testClientId } });
    }
    if (testCompanyId) {
      await prisma.company.deleteMany({ where: { id: testCompanyId } });
    }
  });

  describe("GET /api/v1/commercial/renewals", () => {
    it("should return 401 if unauthenticated", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost:3100/api/v1/commercial/renewals");
      const res = await getRenewals(req);
      expect(res.status).toBe(401);
    });

    it("should return 403 if missing commercial.renewal.view permission", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: {
          id: "emp-unauthorized",
          role: "EMPLOYEE",
          permissions: ["self.profile.view"]
        }
      });

      const req = new NextRequest("http://localhost:3100/api/v1/commercial/renewals");
      const res = await getRenewals(req);
      expect(res.status).toBe(403);
    });

    it("should return expiring contracts and renewal cases for authorized users", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: "emp-admin-cl8",
          role: "SUPER_ADMIN",
          companyId: testCompanyId,
          permissions: ["commercial.renewal.view"]
        }
      });

      const req = new NextRequest("http://localhost:3100/api/v1/commercial/renewals");
      const res = await getRenewals(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.expiringContracts)).toBe(true);
      expect(Array.isArray(data.renewalCases)).toBe(true);
    });
  });

  describe("POST /api/v1/commercial/renewals (Initiate Case)", () => {
    it("should initiate a new renewal review case", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: "emp-admin-cl8",
          role: "SUPER_ADMIN",
          companyId: testCompanyId,
          permissions: ["commercial.renewal.manage"]
        }
      });

      const req = new NextRequest("http://localhost:3100/api/v1/commercial/renewals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: testActiveContractId,
          targetStartDate: "2026-09-01",
          targetEndDate: "2027-08-31",
          reviewNotes: "Client requested initial renewal proposal."
        })
      });

      const res = await initiateRenewal(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.alreadyExists).toBe(false);
      expect(data.renewalCase.status).toBe("UNDER_REVIEW");

      testRenewalCaseId = data.renewalCase.id;
    });

    it("should handle duplicate initiation attempts idempotently", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: "emp-admin-cl8",
          role: "SUPER_ADMIN",
          companyId: testCompanyId,
          permissions: ["commercial.renewal.manage"]
        }
      });

      const req = new NextRequest("http://localhost:3100/api/v1/commercial/renewals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: testActiveContractId
        })
      });

      const res = await initiateRenewal(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.alreadyExists).toBe(true);
      expect(data.renewalCase.id).toBe(testRenewalCaseId);
    });
  });

  describe("POST /api/v1/commercial/renewals/[caseId]/decision", () => {
    it("should finalize decision as RENEW_NEW_TERM and create a NEW DRAFT contract term", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: "emp-admin-cl8",
          role: "SUPER_ADMIN",
          companyId: testCompanyId,
          permissions: ["commercial.renewal.manage"]
        }
      });

      const req = new NextRequest(`http://localhost:3100/api/v1/commercial/renewals/${testRenewalCaseId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "RENEW_NEW_TERM",
          newStartDate: "2026-09-01",
          newEndDate: "2027-08-31",
          explicitTotalContractValue: 150000,
          decisionReason: "Client accepted 1-year renewal term with expanded headcount."
        })
      });

      const res = await processDecision(req, { params: { caseId: testRenewalCaseId } });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.alreadyFinalized).toBe(false);
      expect(data.renewalCase.status).toBe("RENEWED");
      expect(data.resultingContractId).toBeDefined();

      testDraftContractId = data.resultingContractId;

      // Verify created renewed contract properties
      const renewedContract = await prisma.manpowerContract.findUnique({
        where: { id: testDraftContractId },
        include: { manpowerRequirements: true }
      });

      expect(renewedContract).toBeDefined();
      expect(renewedContract?.status).toBe("DRAFT"); // Must NOT automatically activate
      expect(renewedContract?.approvalStatus).toBe("DRAFT");
      expect(renewedContract?.renewalOfContractId).toBe(testActiveContractId); // Self-relation provenance
      expect(renewedContract?.totalContractValue).toBe(150000);
      expect(renewedContract?.manpowerRequirements.length).toBeGreaterThan(0);
    });

    it("should handle repeated decision processing idempotently", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          id: "emp-admin-cl8",
          role: "SUPER_ADMIN",
          companyId: testCompanyId,
          permissions: ["commercial.renewal.manage"]
        }
      });

      const req = new NextRequest(`http://localhost:3100/api/v1/commercial/renewals/${testRenewalCaseId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "RENEW_NEW_TERM",
          newStartDate: "2026-09-01",
          newEndDate: "2027-08-31"
        })
      });

      const res = await processDecision(req, { params: { caseId: testRenewalCaseId } });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.alreadyFinalized).toBe(true);
    });
  });
});
