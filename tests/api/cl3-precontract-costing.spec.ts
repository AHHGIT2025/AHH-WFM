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
    // Purge any stale CL3 test templates left over from prior failed runs.
    // Prior failures can leave a template with levels already deleted but the template still active,
    // causing the workflow route's `levels: { some: {} }` filter to return null.
    const staleTemplates = await prisma.workflowTemplate.findMany({
      where: { workflowName: { startsWith: "CL3 Test" } },
      select: { id: true }
    });
    if (staleTemplates.length > 0) {
      const staleIds = staleTemplates.map((t: any) => t.id);
      // Delete WorkflowInstances (cascade deletes WorkflowActionHistory)
      await prisma.workflowInstance.deleteMany({ where: { templateId: { in: staleIds } } });
      // Delete template structural records
      await prisma.workflowTemplateApprover.deleteMany({ where: { level: { templateId: { in: staleIds } } } });
      await prisma.workflowTemplateLevel.deleteMany({ where: { templateId: { in: staleIds } } });
      await prisma.workflowTemplate.deleteMany({ where: { id: { in: staleIds } } });
    }

    // Always create a fresh, correctly-structured single-level test template
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
  });

  afterAll(async () => {
    // Cleanup workflow template first (WorkflowInstances cascade from Section 7/8/11 workflow tests)
    if (testWorkflowTemplate) {
      await prisma.workflowInstance.deleteMany({ where: { templateId: testWorkflowTemplate.id } });
      await prisma.workflowTemplateApprover.deleteMany({ where: { level: { templateId: testWorkflowTemplate.id } } });
      await prisma.workflowTemplateLevel.deleteMany({ where: { templateId: testWorkflowTemplate.id } });
      await prisma.workflowTemplate.delete({ where: { id: testWorkflowTemplate.id } });
    }
    // Cleanup costing data
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

  // -------------------------------------------------------------
  // SECTION 10: MULTI-LEVEL WORKFLOW (CENTRALIZED)
  // -------------------------------------------------------------
  describe("10. Multi-Level Centralized Workflow", () => {
    let multiLevelTemplate: any;
    let multiLevelEstimate: any;

    it("should set up a 2-level centralized WorkflowTemplate", async () => {
      // Deactivate existing single-level template to avoid conflict
      if (testWorkflowTemplate) {
        await prisma.workflowTemplate.update({
          where: { id: testWorkflowTemplate.id },
          data: { isActive: false }
        });
      }

      multiLevelTemplate = await prisma.workflowTemplate.create({
        data: {
          workflowName: "CL3 Multi-Level Costing Template",
          moduleType: "PRE_CONTRACT_COSTING",
          appliesTo: "APPROVAL",
          isActive: true,
          isDefault: true,
          levels: {
            create: [
              {
                levelNumber: 1,
                levelName: "Level 1 — Commercial Supervisor Review",
                approvers: {
                  create: [{ approverType: "ROLE_BASED", roleName: "COMMERCIAL_MANAGER" }]
                }
              },
              {
                levelNumber: 2,
                levelName: "Level 2 — Commercial Director Final Approval",
                approvers: {
                  create: [{ approverType: "ROLE_BASED", roleName: "COMMERCIAL_DIRECTOR" }]
                }
              }
            ]
          }
        }
      });
      expect(multiLevelTemplate).toBeDefined();
      expect(multiLevelTemplate.id).toBeDefined();
    });

    it("should SUBMIT draft costing and create WorkflowInstance at Level 1", async () => {
      // Create draft estimate
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockSuperAdmin });
      const createRes = await postCosting(new Request("http://localhost:3100/api/v1/commercial/costing", {
        method: "POST",
        body: JSON.stringify({ caseId: testCaseCompA_SG.id, surveyId: testCompletedSurveyCompA_SG.id })
      }));
      expect(createRes.status).toBe(201);
      const { estimate } = await createRes.json();
      multiLevelEstimate = estimate;

      // SUBMIT
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockSgUserCompA });
      const submitRes = await postCostingWorkflow(
        new Request(`http://localhost:3100/api/v1/commercial/costing/${estimate.id}/workflow`, {
          method: "POST",
          body: JSON.stringify({ action: "SUBMIT", remarks: "Multi-level submit test" })
        }),
        { params: { id: estimate.id } }
      );
      expect(submitRes.status).toBe(200);
      const submitData = await submitRes.json();
      expect(submitData.estimate.status).toBe("IN_WORKFLOW");
      expect(submitData.workflow.currentLevelNumber).toBe(1);
      expect(submitData.workflow.status).toBe("IN_PROGRESS");
    });

    it("should advance workflow to Level 2 after Level 1 approval — estimate remains IN_WORKFLOW and NOT APPROVED", async () => {
      const l1ApproverUser = {
        ...mockApproverUser,
        id: "EMP-CL3-L1-APPROVER",
        role: "COMMERCIAL_MANAGER"
      };
      (getServerSession as jest.Mock).mockResolvedValue({ user: l1ApproverUser });

      const l1ApproveRes = await postCostingWorkflow(
        new Request(`http://localhost:3100/api/v1/commercial/costing/${multiLevelEstimate.id}/workflow`, {
          method: "POST",
          body: JSON.stringify({ action: "APPROVE", remarks: "Level 1 approved" })
        }),
        { params: { id: multiLevelEstimate.id } }
      );
      expect(l1ApproveRes.status).toBe(200);
      const l1Data = await l1ApproveRes.json();

      // Estimate must remain IN_WORKFLOW — NOT APPROVED after intermediate level
      expect(l1Data.estimate.status).toBe("IN_WORKFLOW");
      expect(l1Data.estimate.status).not.toBe("APPROVED");
      // Current level must have advanced to 2
      expect(l1Data.workflow.currentLevelNumber).toBe(2);
      expect(l1Data.workflow.status).toBe("IN_PROGRESS");
      // Version must NOT be approved yet
      expect(l1Data.estimate.versions[0].status).not.toBe("APPROVED");
      // Snapshot must NOT be written at intermediate step
      expect(l1Data.estimate.versions[0].snapshotJson).toBeNull();
    });

    it("should reject Level 2 approval attempt from unauthorized user (COMMERCIAL_MANAGER role at Level 2)", async () => {
      // COMMERCIAL_MANAGER is authorized for Level 1 only; Level 2 requires COMMERCIAL_DIRECTOR
      const unauthorizedL2User = {
        ...mockApproverUser,
        id: "EMP-CL3-L1-APPROVER-RETRY",
        role: "COMMERCIAL_MANAGER"
      };
      (getServerSession as jest.Mock).mockResolvedValue({ user: unauthorizedL2User });

      const l2UnauthorizedRes = await postCostingWorkflow(
        new Request(`http://localhost:3100/api/v1/commercial/costing/${multiLevelEstimate.id}/workflow`, {
          method: "POST",
          body: JSON.stringify({ action: "APPROVE", remarks: "Attempting unauthorized Level 2 approval" })
        }),
        { params: { id: multiLevelEstimate.id } }
      );
      expect(l2UnauthorizedRes.status).toBe(403);
    });

    it("should APPROVE at Level 2 (final), set estimate APPROVED, and write SHA-256 snapshot only at final level", async () => {
      const l2ApproverUser = {
        id: "EMP-CL3-L2-DIRECTOR",
        name: "Commercial Director L2",
        role: "COMMERCIAL_DIRECTOR",
        companyId: "COMP-CL3-A",
        permissions: ["precontract.costing.view", "precontract.workflow.review", "precontract.workflow.approve"],
        operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true }
      };
      (getServerSession as jest.Mock).mockResolvedValue({ user: l2ApproverUser });

      const l2ApproveRes = await postCostingWorkflow(
        new Request(`http://localhost:3100/api/v1/commercial/costing/${multiLevelEstimate.id}/workflow`, {
          method: "POST",
          body: JSON.stringify({ action: "APPROVE", remarks: "Final Level 2 director approval" })
        }),
        { params: { id: multiLevelEstimate.id } }
      );
      expect(l2ApproveRes.status).toBe(200);
      const l2Data = await l2ApproveRes.json();

      expect(l2Data.estimate.status).toBe("APPROVED");
      expect(l2Data.estimate.versions[0].status).toBe("APPROVED");
      // Snapshot must be written only at final approval
      expect(l2Data.estimate.versions[0].snapshotJson).toBeDefined();
      expect(l2Data.estimate.versions[0].checksum).toHaveLength(64);
      expect(l2Data.workflow.status).toBe("APPROVED");
    });

    afterAll(async () => {
      // Cleanup multi-level template records and reactivate original
      if (multiLevelTemplate) {
        // Must delete WorkflowInstance records (FK: WorkflowInstance.templateId → WorkflowTemplate.id)
        // WorkflowActionHistory is cascade-deleted when WorkflowInstance is deleted
        // Null out workflowInstanceId in versions to avoid orphan constraints
        await prisma.workflowInstance.deleteMany({ where: { templateId: multiLevelTemplate.id } });
        await prisma.workflowTemplateApprover.deleteMany({ where: { level: { templateId: multiLevelTemplate.id } } });
        await prisma.workflowTemplateLevel.deleteMany({ where: { templateId: multiLevelTemplate.id } });
        await prisma.workflowTemplate.delete({ where: { id: multiLevelTemplate.id } });
      }
      // Reactivate the original template so Section 11+ tests can find an active template
      if (testWorkflowTemplate) {
        await prisma.workflowTemplate.update({
          where: { id: testWorkflowTemplate.id },
          data: { isActive: true }
        });
      }
    });
  });

  // -------------------------------------------------------------
  // SECTION 11: EXPLICIT REJECT TEST
  // -------------------------------------------------------------
  describe("11. Explicit REJECT Test", () => {
    it("should REJECT costing estimate and prove no snapshot is created", async () => {
      // 1. Create fresh draft
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockSuperAdmin });
      const createRes = await postCosting(new Request("http://localhost:3100/api/v1/commercial/costing", {
        method: "POST",
        body: JSON.stringify({ caseId: testCaseCompA_SG.id, surveyId: testCompletedSurveyCompA_SG.id })
      }));
      expect(createRes.status).toBe(201);
      const { estimate } = await createRes.json();

      // 2. SUBMIT
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockSgUserCompA });
      await postCostingWorkflow(
        new Request(`http://localhost:3100/api/v1/commercial/costing/${estimate.id}/workflow`, {
          method: "POST",
          body: JSON.stringify({ action: "SUBMIT" })
        }),
        { params: { id: estimate.id } }
      );

      // 3. REJECT as authorized approver
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockApproverUser });
      const rejectRes = await postCostingWorkflow(
        new Request(`http://localhost:3100/api/v1/commercial/costing/${estimate.id}/workflow`, {
          method: "POST",
          body: JSON.stringify({ action: "REJECT", remarks: "Cost assumptions not validated by operations." })
        }),
        { params: { id: estimate.id } }
      );
      expect(rejectRes.status).toBe(200);
      const rejectData = await rejectRes.json();

      // Assertions
      expect(rejectData.estimate.status).toBe("REJECTED");
      expect(rejectData.estimate.versions[0].status).toBe("REJECTED");
      expect(rejectData.workflow.status).toBe("REJECTED");
      // No approved snapshot must be created on rejection
      expect(rejectData.estimate.versions[0].snapshotJson).toBeNull();
      expect(rejectData.estimate.versions[0].checksum).toBeNull();
    });
  });

  // -------------------------------------------------------------
  // SECTION 12: DEDICATED NON-ADMIN CROSS-COMPANY PERMISSION
  // -------------------------------------------------------------
  describe("12. Dedicated Non-Admin Cross-Company Permission", () => {
    let compBEstimateId: string;
    let compBSurveyId: string; // tracked for afterAll cleanup

    beforeAll(async () => {
      // Create a COMPLETED survey for Company B case separately so ID can be tracked for cleanup
      const compBSurvey = await prisma.preContractSurvey.create({
        data: { caseId: testCaseCompB_SG.id, lifecycle: "COMPLETED" }
      });
      compBSurveyId = compBSurvey.id;

      // Create a Company B estimate via SUPER_ADMIN
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockSuperAdmin });
      const createRes = await postCosting(new Request("http://localhost:3100/api/v1/commercial/costing", {
        method: "POST",
        body: JSON.stringify({ caseId: testCaseCompB_SG.id, surveyId: compBSurveyId })
      }));
      const data = await createRes.json();
      compBEstimateId = data.estimate?.id;
    });

    it("should BLOCK non-admin Company A user WITHOUT crossCompany permission from listing Company B estimates", async () => {
      const compAUserNoCrossCompany = {
        id: "EMP-CL3-SG-A-NO-CROSS",
        name: "SG Officer No Cross-Company",
        role: "COMMERCIAL_OFFICER",
        companyId: "COMP-CL3-A",
        // Has view + manage but NOT crossCompany
        permissions: ["precontract.costing.view", "precontract.costing.manage", "precontract.workflow.submit"],
        operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: false }
      };
      (getServerSession as jest.Mock).mockResolvedValue({ user: compAUserNoCrossCompany });
      const listRes = await getCosting(new Request("http://localhost:3100/api/v1/commercial/costing"));
      const listData = await listRes.json();
      // Company B estimate must NOT appear for Company A user without crossCompany permission
      const found = listData.estimates.find((e: any) => e.id === compBEstimateId);
      expect(found).toBeUndefined();
    });

    it("should ALLOW non-admin Company A user WITH crossCompany permission to see Company B estimates in list", async () => {
      const compAUserWithCrossCompany = {
        id: "EMP-CL3-SG-A-CROSS",
        name: "SG Officer With Cross-Company",
        role: "COMMERCIAL_OFFICER",
        companyId: "COMP-CL3-A",
        // Has view + crossCompany but is NOT admin/SUPER_ADMIN
        permissions: ["precontract.costing.view", "precontract.costing.crossCompany"],
        operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true }
      };
      (getServerSession as jest.Mock).mockResolvedValue({ user: compAUserWithCrossCompany });
      const listRes = await getCosting(new Request("http://localhost:3100/api/v1/commercial/costing"));
      const listData = await listRes.json();
      // Company B estimate MUST appear for user WITH crossCompany permission
      const found = listData.estimates.find((e: any) => e.id === compBEstimateId);
      expect(found).toBeDefined();
    });

    afterAll(async () => {
      // Clean up the Section 12 estimate and survey to prevent FK violation in the global afterAll
      if (compBEstimateId) {
        await prisma.preContractCostEstimateItem.deleteMany({
          where: { estimateVersion: { estimateId: compBEstimateId } }
        });
        await prisma.preContractCostEstimateVersion.deleteMany({ where: { estimateId: compBEstimateId } });
        await prisma.preContractCostEstimate.delete({ where: { id: compBEstimateId } });
      }
      if (compBSurveyId) {
        await prisma.preContractSurvey.delete({ where: { id: compBSurveyId } });
      }
    });
  });

  // -------------------------------------------------------------
  // SECTION 13: CASE-STATE GUARDS
  // -------------------------------------------------------------
  describe("13. Case-State Guards", () => {
    it("should ALLOW costing creation when case lifecycle is DRAFT (allowed active state)", async () => {
      // testCaseCompA_SG has lifecycle DRAFT — this is the allowed state in current implementation
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockSuperAdmin });
      const createRes = await postCosting(new Request("http://localhost:3100/api/v1/commercial/costing", {
        method: "POST",
        body: JSON.stringify({
          caseId: testCaseCompA_SG.id,
          surveyId: testCompletedSurveyCompA_SG.id
        })
      }));
      // Should create successfully (201) — DRAFT is an allowed case state for costing
      expect(createRes.status).toBe(201);
      const data = await createRes.json();
      expect(data.estimate).toBeDefined();
      expect(data.estimate.status).toBe("DRAFT");
    });

    it("should REJECT costing creation when case lifecycle is CANCELLED (disallowed state)", async () => {
      // Create a CANCELLED case and attempt costing against it
      const cancelledCase = await prisma.preContractCase.create({
        data: {
          title: "CL3 Cancelled Case for Guard Test",
          companyId: "COMP-CL3-A",
          operationType: "SECURITY_GUARDING",
          lifecycle: "CANCELLED",
          createdBy: "SYSTEM"
        }
      });

      const cancelledSurvey = await prisma.preContractSurvey.create({
        data: { caseId: cancelledCase.id, lifecycle: "COMPLETED" }
      });

      (getServerSession as jest.Mock).mockResolvedValue({ user: mockSuperAdmin });
      const createRes = await postCosting(new Request("http://localhost:3100/api/v1/commercial/costing", {
        method: "POST",
        body: JSON.stringify({ caseId: cancelledCase.id, surveyId: cancelledSurvey.id })
      }));

      // CANCELLED case must be rejected
      expect(createRes.status).toBe(400);
      const data = await createRes.json();
      expect(data.error).toBeDefined();

      // Cleanup
      await prisma.preContractSurvey.delete({ where: { id: cancelledSurvey.id } });
      await prisma.preContractCase.delete({ where: { id: cancelledCase.id } });
    });
  });
});
