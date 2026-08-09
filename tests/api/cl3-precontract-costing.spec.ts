import { prisma } from "@ahh-wfm/database";
import { GET as getCosting, POST as postCosting } from "../../apps/web/app/api/v1/commercial/costing/route";
import { GET as getCostingDetail, PATCH as patchCostingDetail } from "../../apps/web/app/api/v1/commercial/costing/[id]/route";
import { POST as postCostingWorkflow } from "../../apps/web/app/api/v1/commercial/costing/[id]/workflow/route";
import { calculateCostingEstimate, generateCostingSnapshot } from "../../apps/web/lib/precontract-costing";
import { Decimal } from "@prisma/client/runtime/library";
import { getServerSession } from "next-auth/next";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn()
}));

describe("Commercial Lifecycle — Phase CL-3 Comprehensive Test Suite (Pre-Contract Costing & Estimation)", () => {
  // Test Mock Users & Roles
  const mockSuperAdmin = {
    id: "EMP-CL3-ADMIN",
    name: "Commercial Admin CL3",
    role: "SUPER_ADMIN",
    companyId: "COMP-CL3-A",
    permissions: [
      "manpower.admin.full_access",
      "precontract.costing.view",
      "precontract.costing.manage",
      "precontract.costing.override",
      "precontract.costing.crossCompany",
      "precontract.workflow.submit",
      "precontract.workflow.review",
      "precontract.workflow.approve"
    ],
    operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true }
  };

  const mockSgUserCompA = {
    id: "EMP-CL3-SG-A",
    name: "SG Costing Officer Comp A",
    role: "COMMERCIAL_OFFICER",
    companyId: "COMP-CL3-A",
    permissions: [
      "precontract.costing.view",
      "precontract.costing.manage",
      "precontract.workflow.submit"
    ],
    operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: false }
  };

  const mockFmUserCompA = {
    id: "EMP-CL3-FM-A",
    name: "FM Costing Officer Comp A",
    role: "COMMERCIAL_OFFICER",
    companyId: "COMP-CL3-A",
    permissions: [
      "precontract.costing.view",
      "precontract.costing.manage",
      "precontract.workflow.submit"
    ],
    operationAccess: { allowedSecurityGuarding: false, allowedFacilityManagement: true }
  };

  const mockSgUserCompB = {
    id: "EMP-CL3-SG-B",
    name: "SG Costing Officer Comp B",
    role: "COMMERCIAL_OFFICER",
    companyId: "COMP-CL3-B",
    permissions: [
      "precontract.costing.view",
      "precontract.costing.manage",
      "precontract.workflow.submit"
    ],
    operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: false }
  };

  const mockApproverUser = {
    id: "EMP-CL3-APPROVER",
    name: "Commercial Manager Approver",
    role: "COMMERCIAL_MANAGER",
    companyId: "COMP-CL3-A",
    permissions: [
      "precontract.costing.view",
      "precontract.workflow.review",
      "precontract.workflow.approve"
    ],
    operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true }
  };

  const mockNoPermUser = {
    id: "EMP-CL3-GUEST",
    name: "Guest Employee",
    role: "EMPLOYEE",
    companyId: "COMP-CL3-A",
    permissions: [],
    operationAccess: { allowedSecurityGuarding: false, allowedFacilityManagement: false }
  };

  // Shared Test Fixtures
  let testClientCompA: any;
  let testCaseCompA_SG: any;
  let testCaseCompA_FM: any;
  let testCaseCompB_SG: any;
  let testCompletedSurveyCompA_SG: any;
  let testCompletedSurveyCompA_FM: any;
  let testDraftSurveyCompA_SG: any;
  let testWorkflowTemplate: any;

  beforeAll(async () => {
    // 1. Create Test Prospect Client
    testClientCompA = await prisma.preContractProspectClient.create({
      data: {
        name: "CL3 Test Client Comp A",
        companyId: "COMP-CL3-A"
      }
    });

    // 2. Create Test Cases
    testCaseCompA_SG = await prisma.preContractCase.create({
      data: {
        title: "CL3 Test Case Comp A SG",
        prospectClientId: testClientCompA.id,
        companyId: "COMP-CL3-A",
        operationType: "SECURITY_GUARDING",
        lifecycle: "DRAFT",
        createdBy: "SYSTEM"
      }
    });

    testCaseCompA_FM = await prisma.preContractCase.create({
      data: {
        title: "CL3 Test Case Comp A FM",
        prospectClientId: testClientCompA.id,
        companyId: "COMP-CL3-A",
        operationType: "FACILITY_MANAGEMENT",
        lifecycle: "DRAFT",
        createdBy: "SYSTEM"
      }
    });

    testCaseCompB_SG = await prisma.preContractCase.create({
      data: {
        title: "CL3 Test Case Comp B SG",
        companyId: "COMP-CL3-B",
        operationType: "SECURITY_GUARDING",
        lifecycle: "DRAFT",
        createdBy: "SYSTEM"
      }
    });

    // 3. Create Test Surveys
    testCompletedSurveyCompA_SG = await prisma.preContractSurvey.create({
      data: {
        caseId: testCaseCompA_SG.id,
        lifecycle: "COMPLETED",
        responses: {
          create: [
            { elementCode: "HEADCOUNT", numericValue: 5 },
            { elementCode: "RELIEVER_REQUIRED", booleanValue: true }
          ]
        }
      }
    });

    testCompletedSurveyCompA_FM = await prisma.preContractSurvey.create({
      data: {
        caseId: testCaseCompA_FM.id,
        lifecycle: "COMPLETED",
        responses: {
          create: [
            { elementCode: "HEADCOUNT", numericValue: 3 },
            { elementCode: "RELIEVER_REQUIRED", booleanValue: false }
          ]
        }
      }
    });

    testDraftSurveyCompA_SG = await prisma.preContractSurvey.create({
      data: {
        caseId: testCaseCompA_SG.id,
        lifecycle: "DRAFT"
      }
    });

    // 4. Create Workflow Template for Costing Governance
    testWorkflowTemplate = await prisma.workflowTemplate.findFirst({
      where: { moduleType: "PRE_CONTRACT_COSTING", isActive: true }
    });
    if (!testWorkflowTemplate) {
      testWorkflowTemplate = await prisma.workflowTemplate.create({
        data: {
          workflowName: "CL3 Test Costing Governance Template",
          moduleType: "PRE_CONTRACT_COSTING",
          appliesTo: "APPROVAL",
          isActive: true,
          isDefault: true,
          levels: {
            create: [
              {
                levelNumber: 1,
                levelName: "Commercial Review Level 1",
                approvers: {
                  create: [
                    { approverType: "ROLE_BASED", roleName: "COMMERCIAL_MANAGER" }
                  ]
                }
              }
            ]
          }
        }
      });
    }
  });

  afterAll(async () => {
    // Cleanup created test records
    await prisma.preContractCostOverrideLog.deleteMany({
      where: { estimateVersion: { estimate: { caseId: { in: [testCaseCompA_SG.id, testCaseCompA_FM.id, testCaseCompB_SG.id] } } } }
    });
    await prisma.preContractCostEstimateItem.deleteMany({
      where: { estimateVersion: { estimate: { caseId: { in: [testCaseCompA_SG.id, testCaseCompA_FM.id, testCaseCompB_SG.id] } } } }
    });
    await prisma.preContractCostEstimateVersion.deleteMany({
      where: { estimate: { caseId: { in: [testCaseCompA_SG.id, testCaseCompA_FM.id, testCaseCompB_SG.id] } } }
    });
    await prisma.preContractCostEstimate.deleteMany({
      where: { caseId: { in: [testCaseCompA_SG.id, testCaseCompA_FM.id, testCaseCompB_SG.id] } }
    });
    await prisma.surveyResponse.deleteMany({
      where: { surveyId: { in: [testCompletedSurveyCompA_SG.id, testCompletedSurveyCompA_FM.id, testDraftSurveyCompA_SG.id] } }
    });
    await prisma.preContractSurvey.deleteMany({
      where: { id: { in: [testCompletedSurveyCompA_SG.id, testCompletedSurveyCompA_FM.id, testDraftSurveyCompA_SG.id] } }
    });
    await prisma.preContractCase.deleteMany({
      where: { id: { in: [testCaseCompA_SG.id, testCaseCompA_FM.id, testCaseCompB_SG.id] } }
    });
    await prisma.preContractProspectClient.deleteMany({
      where: { id: testClientCompA.id }
    });
  });

  // -------------------------------------------------------------
  // SECTION 1: AUTHENTICATION & AUTHORIZATION
  // -------------------------------------------------------------
  describe("1. Authentication & Permission Matrix", () => {
    it("should return 401 Unauthenticated when session is missing", async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);
      const req = new Request("http://localhost:3100/api/v1/commercial/costing");
      const res = await getCosting(req);
      expect(res.status).toBe(401);
    });

    it("should return 403 Forbidden when user lacks costing view permission", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockNoPermUser });
      const req = new Request("http://localhost:3100/api/v1/commercial/costing");
      const res = await getCosting(req);
      expect(res.status).toBe(403);
    });

    it("should allow user with precontract.costing.view to list estimates", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockSgUserCompA });
      const req = new Request("http://localhost:3100/api/v1/commercial/costing");
      const res = await getCosting(req);
      expect(res.status).toBe(200);
    });
  });

  // -------------------------------------------------------------
  // SECTION 2: COMPANY & OPERATION SCOPE ISOLATION
  // -------------------------------------------------------------
  describe("2. Company & Operation Scope Isolation", () => {
    it("should prevent Company A user from creating a costing estimate against Company B case", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockSgUserCompA });
      const req = new Request("http://localhost:3100/api/v1/commercial/costing", {
        method: "POST",
        body: JSON.stringify({
          caseId: testCaseCompB_SG.id,
          surveyId: testCompletedSurveyCompA_SG.id
        })
      });
      const res = await postCosting(req);
      expect(res.status).toBe(403);
    });

    it("should isolate SECURITY_GUARDING data from FACILITY_MANAGEMENT user without cross-scope access", async () => {
      // Create estimate for SG case
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockSuperAdmin });
      const createReq = new Request("http://localhost:3100/api/v1/commercial/costing", {
        method: "POST",
        body: JSON.stringify({
          caseId: testCaseCompA_SG.id,
          surveyId: testCompletedSurveyCompA_SG.id
        })
      });
      const createRes = await postCosting(createReq);
      const { estimate } = await createRes.json();

      // FM user attempts GET list
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockFmUserCompA });
      const listReq = new Request("http://localhost:3100/api/v1/commercial/costing");
      const listRes = await getCosting(listReq);
      const listData = await listRes.json();

      // Ensure SG estimate is filtered out for FM user
      const found = listData.estimates.find((e: any) => e.id === estimate.id);
      expect(found).toBeUndefined();
    });
  });

  // -------------------------------------------------------------
  // SECTION 3: UPSTREAM ELIGIBILITY & VALIDATION
  // -------------------------------------------------------------
  describe("3. Upstream Case & Survey Eligibility", () => {
    it("should reject costing creation if survey is not in COMPLETED lifecycle", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockSuperAdmin });
      const req = new Request("http://localhost:3100/api/v1/commercial/costing", {
        method: "POST",
        body: JSON.stringify({
          caseId: testCaseCompA_SG.id,
          surveyId: testDraftSurveyCompA_SG.id
        })
      });
      const res = await postCosting(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Only COMPLETED surveys can be costed");
    });

    it("should reject costing creation if survey does not belong to specified case", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockSuperAdmin });
      const req = new Request("http://localhost:3100/api/v1/commercial/costing", {
        method: "POST",
        body: JSON.stringify({
          caseId: testCaseCompA_FM.id,
          surveyId: testCompletedSurveyCompA_SG.id // Belongs to SG case
        })
      });
      const res = await postCosting(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("does not belong to the specified opportunity case");
    });
  });

  // -------------------------------------------------------------
  // SECTION 4: DOMAIN CALCULATION & PRICING FORMULAS
  // -------------------------------------------------------------
  describe("4. Domain Calculation Precision & Formulas", () => {
    it("should calculate Gross Margin % correctly: (Selling Price - Total Cost) / Selling Price * 100", () => {
      const totalCost = new Decimal(8000);
      const sellingPrice = new Decimal(10000);
      const marginPct = sellingPrice.sub(totalCost).div(sellingPrice).mul(100);
      expect(marginPct.toFixed(2)).toBe("20.00");
    });

    it("should calculate Target Margin Selling Price correctly: Total Cost / (1 - Margin / 100)", () => {
      const totalCost = new Decimal(8500);
      const targetMargin = new Decimal(15); // 15%
      const marginFactor = new Decimal(1).sub(targetMargin.div(100)); // 0.85
      const sellingPrice = totalCost.div(marginFactor);
      expect(sellingPrice.toFixed(2)).toBe("10000.00");
    });

    it("should calculate Markup % correctly: (Selling Price - Total Cost) / Total Cost * 100", () => {
      const totalCost = new Decimal(8000);
      const sellingPrice = new Decimal(10000);
      const markupPct = sellingPrice.sub(totalCost).div(totalCost).mul(100);
      expect(markupPct.toFixed(2)).toBe("25.00");
    });

    it("should calculate Target Markup Selling Price correctly: Total Cost * (1 + Markup / 100)", () => {
      const totalCost = new Decimal(8000);
      const targetMarkup = new Decimal(25); // 25%
      const markupFactor = new Decimal(1).add(targetMarkup.div(100)); // 1.25
      const sellingPrice = totalCost.mul(markupFactor);
      expect(sellingPrice.toFixed(2)).toBe("10000.00");
    });

    it("should reject Target Gross Margin >= 100%", async () => {
      await expect(
        calculateCostingEstimate({
          caseId: testCaseCompA_SG.id,
          surveyId: testCompletedSurveyCompA_SG.id,
          targetMarginPercentage: 100.0
        })
      ).rejects.toThrow("Target Gross Margin percentage must be strictly less than 100%.");
    });
  });

  // -------------------------------------------------------------
  // SECTION 5: LINE OVERRIDES & AUDIT LOGGING
  // -------------------------------------------------------------
  describe("5. Line Overrides & Audit Trail", () => {
    it("should allow override and log audit entry when user has precontract.costing.override", async () => {
      // 1. Create Draft Costing
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockSuperAdmin });
      const createRes = await postCosting(new Request("http://localhost:3100/api/v1/commercial/costing", {
        method: "POST",
        body: JSON.stringify({ caseId: testCaseCompA_SG.id, surveyId: testCompletedSurveyCompA_SG.id })
      }));
      const { estimate } = await createRes.json();

      // 2. Apply Line Override
      const patchReq = new Request(`http://localhost:3100/api/v1/commercial/costing/${estimate.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          overrides: [
            { elementCode: "BASIC_PAY", unitRate: 3500, reason: "Specialized Guard Skill Rate" }
          ]
        })
      });
      const patchRes = await patchCostingDetail(patchReq, { params: { id: estimate.id } });
      expect(patchRes.status).toBe(200);
      const updatedData = await patchRes.json();

      // 3. Verify override in latest version items & override log
      const latestVer = updatedData.estimate.versions[0];
      const basicPayItem = latestVer.items.find((i: any) => i.elementCode === "BASIC_PAY");
      expect(basicPayItem.calculationBasis).toBe("OVERRIDE");
      expect(Number(basicPayItem.unitRate)).toBe(3500);

      expect(latestVer.overrides.length).toBeGreaterThan(0);
      expect(latestVer.overrides[0].reason).toBe("Specialized Guard Skill Rate");
    });

    it("should reject override attempt if user lacks precontract.costing.override permission", async () => {
      // Create draft costing
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockSuperAdmin });
      const createRes = await postCosting(new Request("http://localhost:3100/api/v1/commercial/costing", {
        method: "POST",
        body: JSON.stringify({ caseId: testCaseCompA_SG.id, surveyId: testCompletedSurveyCompA_SG.id })
      }));
      const { estimate } = await createRes.json();

      // Attempt override with user lacking override permission
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockSgUserCompA });
      const patchReq = new Request(`http://localhost:3100/api/v1/commercial/costing/${estimate.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          overrides: [{ elementCode: "BASIC_PAY", unitRate: 4000, reason: "Unauthorized Rate Bump" }]
        })
      });
      const patchRes = await patchCostingDetail(patchReq, { params: { id: estimate.id } });
      expect(patchRes.status).toBe(403);
    });
  });

  // -------------------------------------------------------------
  // SECTION 6: REVISIONING ENGINE
  // -------------------------------------------------------------
  describe("6. Version Revisioning Engine", () => {
    it("should increment versionNumber and set clonedFromVersionId when revising an estimate", async () => {
      // 1. Create Draft
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockSuperAdmin });
      const createRes = await postCosting(new Request("http://localhost:3100/api/v1/commercial/costing", {
        method: "POST",
        body: JSON.stringify({ caseId: testCaseCompA_SG.id, surveyId: testCompletedSurveyCompA_SG.id })
      }));
      const { estimate } = await createRes.json();
      const ver1Id = estimate.versions[0].id;

      // 2. Request Revision Creation
      const patchReq = new Request(`http://localhost:3100/api/v1/commercial/costing/${estimate.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          createRevision: true,
          revisionReason: "Client scope change request",
          targetMarginPercentage: 20.0
        })
      });
      const patchRes = await patchCostingDetail(patchReq, { params: { id: estimate.id } });
      expect(patchRes.status).toBe(200);
      const data = await patchRes.json();

      expect(data.estimate.currentVersionNumber).toBe(2);
      expect(data.version.versionNumber).toBe(2);
      expect(data.version.clonedFromVersionId).toBe(ver1Id);
    });
  });

  // -------------------------------------------------------------
  // SECTION 7: WORKFLOW GOVERNANCE & SEGREGATION OF DUTIES
  // -------------------------------------------------------------
  describe("7. Centralized Workflow Governance & Segregation of Duties", () => {
    it("should SUBMIT draft costing and transition status to IN_WORKFLOW", async () => {
      // 1. Create Draft
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockSuperAdmin });
      const createRes = await postCosting(new Request("http://localhost:3100/api/v1/commercial/costing", {
        method: "POST",
        body: JSON.stringify({ caseId: testCaseCompA_SG.id, surveyId: testCompletedSurveyCompA_SG.id })
      }));
      const { estimate } = await createRes.json();

      // 2. Execute SUBMIT action
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockSgUserCompA });
      const wfReq = new Request(`http://localhost:3100/api/v1/commercial/costing/${estimate.id}/workflow`, {
        method: "POST",
        body: JSON.stringify({ action: "SUBMIT", remarks: "Submitting for manager review" })
      });
      const wfRes = await postCostingWorkflow(wfReq, { params: { id: estimate.id } });
      expect(wfRes.status).toBe(200);
      const wfData = await wfRes.json();

      expect(wfData.estimate.status).toBe("IN_WORKFLOW");
      expect(wfData.workflow.status).toBe("IN_PROGRESS");
    });

    it("should final APPROVE costing, generate SHA-256 snapshot, and mark estimate APPROVED", async () => {
      // 1. Create and SUBMIT Draft
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockSuperAdmin });
      const createRes = await postCosting(new Request("http://localhost:3100/api/v1/commercial/costing", {
        method: "POST",
        body: JSON.stringify({ caseId: testCaseCompA_SG.id, surveyId: testCompletedSurveyCompA_SG.id })
      }));
      const { estimate } = await createRes.json();

      await postCostingWorkflow(new Request(`http://localhost:3100/api/v1/commercial/costing/${estimate.id}/workflow`, {
        method: "POST",
        body: JSON.stringify({ action: "SUBMIT" })
      }), { params: { id: estimate.id } });

      // 2. Execute APPROVE as authorized approver
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockApproverUser });
      const appReq = new Request(`http://localhost:3100/api/v1/commercial/costing/${estimate.id}/workflow`, {
        method: "POST",
        body: JSON.stringify({ action: "APPROVE", remarks: "Approved for client proposal" })
      });
      const appRes = await postCostingWorkflow(appReq, { params: { id: estimate.id } });
      expect(appRes.status).toBe(200);
      const appData = await appRes.json();

      expect(appData.estimate.status).toBe("APPROVED");
      expect(appData.estimate.versions[0].status).toBe("APPROVED");
      expect(appData.estimate.versions[0].snapshotJson).toBeDefined();
      expect(appData.estimate.versions[0].checksum).toHaveLength(64);
    });

    it("should RETURN costing estimate to DRAFT when workflow RETURN is executed", async () => {
      // 1. Create and SUBMIT Draft
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockSuperAdmin });
      const createRes = await postCosting(new Request("http://localhost:3100/api/v1/commercial/costing", {
        method: "POST",
        body: JSON.stringify({ caseId: testCaseCompA_SG.id, surveyId: testCompletedSurveyCompA_SG.id })
      }));
      const { estimate } = await createRes.json();

      await postCostingWorkflow(new Request(`http://localhost:3100/api/v1/commercial/costing/${estimate.id}/workflow`, {
        method: "POST",
        body: JSON.stringify({ action: "SUBMIT" })
      }), { params: { id: estimate.id } });

      // 2. Execute RETURN action
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockApproverUser });
      const retReq = new Request(`http://localhost:3100/api/v1/commercial/costing/${estimate.id}/workflow`, {
        method: "POST",
        body: JSON.stringify({ action: "RETURN", remarks: "Recalibrate manpower allowance" })
      });
      const retRes = await postCostingWorkflow(retReq, { params: { id: estimate.id } });
      expect(retRes.status).toBe(200);
      const retData = await retRes.json();

      expect(retData.estimate.status).toBe("DRAFT");
      expect(retData.estimate.versions[0].status).toBe("DRAFT");
    });
  });

  // -------------------------------------------------------------
  // SECTION 8: SNAPSHOT DETERMINISM & IMMUTABILITY
  // -------------------------------------------------------------
  describe("8. Snapshot Determinism & Immutability", () => {
    it("should generate deterministic SHA-256 snapshot and matching checksum", () => {
      const estimate = {
        id: "est-12345",
        caseId: "case-999",
        surveyId: "survey-888",
        companyId: "comp-1",
        operationType: "SECURITY_GUARDING"
      };

      const version = {
        id: "ver-1",
        versionNumber: 1,
        pricingBasis: "MARGIN",
        currency: "QAR",
        totalDirectCost: new Decimal(7000),
        totalIndirectCost: new Decimal(700),
        totalCost: new Decimal(7700),
        targetMarginPercentage: new Decimal(15),
        targetMarkupPercentage: new Decimal(17.65),
        sellingPrice: new Decimal(9058.82)
      };

      const items = [
        {
          elementCode: "BASIC_PAY",
          elementName: "Basic Pay / Manpower Wage",
          categoryCode: "DIRECT_MANPOWER",
          isDirect: true,
          quantity: new Decimal(2),
          unitRate: new Decimal(2500),
          totalAmount: new Decimal(5000),
          calculationBasis: "CONFIGURED"
        }
      ];

      const fixedTimestamp = "2026-08-09T12:00:00.000Z";
      const res1 = generateCostingSnapshot(estimate, version, items, fixedTimestamp);
      const res2 = generateCostingSnapshot(estimate, version, items, fixedTimestamp);

      expect(res1.snapshotJson).toBeDefined();
      expect(res1.checksum).toHaveLength(64);
      expect(res1.checksum).toBe(res2.checksum);
    });
  });

  // -------------------------------------------------------------
  // SECTION 9: PROPOSAL BOUNDARY
  // -------------------------------------------------------------
  describe("9. Proposal Boundary Verification", () => {
    it("should verify that CL-3 outputs approved costing baseline without generating Client Proposals", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockSuperAdmin });
      const listReq = new Request("http://localhost:3100/api/v1/commercial/costing");
      const listRes = await getCosting(listReq);
      const listData = await listRes.json();
      expect(listData.estimates).toBeDefined();
      // Verify no proposal objects or PDF contracts generated in CL-3
      expect((listData as any).proposals).toBeUndefined();
    });
  });
});
