import { prisma, Prisma } from "@ahh-wfm/database";
import { GET as getCosting, POST as postCosting } from "../../apps/web/app/api/v1/commercial/costing/route";
import { GET as getCostingDetail, PATCH as patchCostingDetail } from "../../apps/web/app/api/v1/commercial/costing/[id]/route";
import { POST as postCostingWorkflow } from "../../apps/web/app/api/v1/commercial/costing/[id]/workflow/route";
import { GET as getOpportunities } from "../../apps/web/app/api/v1/commercial/opportunities/route";
import { GET as getProposals, POST as postProposals } from "../../apps/web/app/api/v1/commercial/proposals/route";
import { POST as postProposalWorkflow } from "../../apps/web/app/api/v1/commercial/proposals/[id]/workflow/route";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import {
  calculateCostingEstimate,
  generateCostingSnapshot,
  serializeCostingEstimate,
  toSafeCostingNumber as toSafeNumber,
  formatMarginPercentage,
  formatCostingCurrency
} from "../../apps/web/lib/precontract-costing";
import { getServerSession } from "next-auth/next";
import { mockDb } from "@ahh-wfm/mock-data";

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

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

  beforeEach(() => {
    jest.spyOn(mockDb, "getUserRoleAssignments").mockResolvedValue([] as any);
    jest.spyOn(mockDb, "getEmployees").mockImplementation(async () => {
      const s = await (getServerSession as jest.Mock)();
      if (!s || !s.user || !s.user.id) return [];
      return [
        {
          id: s.user.id,
          name: s.user.name || s.user.id,
          email: s.user.email || `${s.user.id}@ahh.com`,
          role: s.user.role || "EMPLOYEE",
          companyId: s.user.companyId ?? null,
          departmentId: s.user.departmentId ?? null,
          isActive: s.user.isActive !== false,
          employmentStatus: s.user.employmentStatus || "ACTIVE",
          isLoginEnabled: s.user.isLoginEnabled !== false,
          isLocked: Boolean(s.user.isLocked),
          webAccessEnabled: s.user.webAccessEnabled !== false,
          mobileAccessEnabled: s.user.mobileAccessEnabled !== false
        }
      ] as any;
    });
  });

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

  // -------------------------------------------------------------
  // SECTION 14: T1-DEF-026 REGRESSION — NUMERIC SERIALIZATION & UI RENDERING
  // -------------------------------------------------------------
  describe("14. T1-DEF-026 Regression — Numeric Serialization & UI Rendering", () => {
    it("should serialize all Prisma Decimal fields as JavaScript numbers across POST, GET list, GET detail, PATCH, and workflow APIs", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockSgUserCompA });

      // 1. Create Draft Costing with targetMarginPercentage = 15.5
      const createRes = await postCosting(
        new Request("http://localhost:3100/api/v1/commercial/costing", {
          method: "POST",
          body: JSON.stringify({
            caseId: testCaseCompA_SG.id,
            surveyId: testCompletedSurveyCompA_SG.id,
            pricingBasis: "MARGIN",
            targetMarginPercentage: 15.5
          })
        })
      );
      expect(createRes.status).toBe(201);
      const createData = await createRes.json();
      const createdVer = createData.estimate.versions[0];

      expect(typeof createdVer.targetMarginPercentage).toBe("number");
      expect(createdVer.targetMarginPercentage).toBe(15.5);
      expect(typeof createdVer.totalDirectCost).toBe("number");
      expect(typeof createdVer.totalIndirectCost).toBe("number");
      expect(typeof createdVer.totalCost).toBe("number");
      expect(typeof createdVer.sellingPrice).toBe("number");
      expect(createdVer.targetMarginPercentage.toFixed(2)).toBe("15.50");

      for (const item of createdVer.items) {
        expect(typeof item.quantity).toBe("number");
        expect(typeof item.unitRate).toBe("number");
        expect(typeof item.totalAmount).toBe("number");
      }

      // 2. GET /api/v1/commercial/costing list response
      const listRes = await getCosting(new Request("http://localhost:3100/api/v1/commercial/costing"));
      expect(listRes.status).toBe(200);
      const listData = await listRes.json();
      const listedEst = listData.estimates.find((e: any) => e.id === createData.estimate.id);
      expect(listedEst).toBeDefined();
      const listedVer = listedEst.versions[0];
      expect(typeof listedVer.targetMarginPercentage).toBe("number");
      expect(typeof listedVer.totalCost).toBe("number");
      expect(typeof listedVer.sellingPrice).toBe("number");
      expect(() => listedVer.targetMarginPercentage.toFixed(2)).not.toThrow();
      expect(formatMarginPercentage(listedVer.targetMarginPercentage)).toBe("15.50%");

      // 3. GET /api/v1/commercial/costing/[id] detail response
      const detailRes = await getCostingDetail(
        new Request(`http://localhost:3100/api/v1/commercial/costing/${createData.estimate.id}`),
        { params: { id: createData.estimate.id } }
      );
      expect(detailRes.status).toBe(200);
      const detailData = await detailRes.json();
      const detailVer = detailData.estimate.versions[0];
      expect(typeof detailVer.targetMarginPercentage).toBe("number");
      expect(detailVer.targetMarginPercentage.toFixed(2)).toBe("15.50");

      // 4. Safely render stringified / Decimal / null values via UI transformation helpers
      expect(formatMarginPercentage("15")).toBe("15.00%");
      expect(formatMarginPercentage("18.756")).toBe("18.76%");
      expect(formatMarginPercentage(new Decimal("22.5"))).toBe("22.50%");
      expect(formatMarginPercentage(null)).toBe("0.00%");
      expect(formatMarginPercentage(undefined)).toBe("0.00%");
      expect(toSafeNumber("15.00")).toBe(15);
      expect(formatCostingCurrency("4500.5", "QAR")).toContain("QAR");

      const serializedRaw = serializeCostingEstimate({
        id: "est-raw-decimal",
        versions: [
          {
            id: "ver-raw-decimal",
            totalDirectCost: "3500.00",
            totalIndirectCost: "350.00",
            totalCost: "3850.00",
            targetMarginPercentage: "15.00",
            targetMarkupPercentage: "17.65",
            sellingPrice: "4529.41",
            items: [
              {
                elementCode: "BASIC_PAY",
                quantity: "5.0000",
                unitRate: "2500.00",
                totalAmount: "12500.00"
              }
            ]
          }
        ]
      });
      expect(typeof serializedRaw.versions[0].targetMarginPercentage).toBe("number");
      expect(serializedRaw.versions[0].targetMarginPercentage?.toFixed(2)).toBe("15.00");
      expect(typeof serializedRaw.versions[0].items[0].unitRate).toBe("number");
    });
  });

  // -------------------------------------------------------------
  // SECTION 15: VIBE-14 REGRESSION — COSTING CLIENT/SITE, DRAFT ITEMS & PROPOSAL FLOW (T1-009 / T1-010)
  // -------------------------------------------------------------
  describe("15. VIBE-14 Regression — Costing Client/Site, Draft Line Items & Proposal UAT Flow", () => {
    let vibe14Site: any;
    let vibe14WonCase: any;
    let vibe14Survey: any;
    let vibe14Estimate: any;
    let vibe14ApprovedVersionId: string;
    let vibe14ProposalId: string;

    const mockCommercialCreator = {
      id: "EMP-VIBE14-CREATOR",
      name: "Commercial Creator VIBE14",
      role: "COMMERCIAL_OFFICER",
      companyId: "COMP-CL3-A",
      permissions: [
        "precontract.case.view",
        "precontract.costing.view",
        "precontract.costing.manage",
        "precontract.costing.override",
        "precontract.proposal.view",
        "precontract.proposal.manage",
        "precontract.workflow.submit"
      ],
      operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: false }
    };

    const mockProposalApprover = {
      id: "EMP-VIBE14-APPROVER",
      name: "Proposal Approver VIBE14",
      role: "COMMERCIAL_MANAGER",
      companyId: "COMP-CL3-A",
      permissions: [
        "precontract.costing.view",
        "precontract.proposal.view",
        "precontract.workflow.review",
        "precontract.workflow.approve"
      ],
      operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: false }
    };

    beforeAll(async () => {
      vibe14Site = await prisma.preContractProspectiveSite.create({
        data: {
          name: "QP Tower A — VIBE14 Site",
          address: "West Bay, Doha",
          companyId: "COMP-CL3-A",
          operationType: "SECURITY_GUARDING"
        }
      });

      vibe14WonCase = await prisma.preContractCase.create({
        data: {
          title: "UAT-SG-T1-20260811-OPP",
          prospectClientId: testClientCompA.id,
          companyId: "COMP-CL3-A",
          operationType: "SECURITY_GUARDING",
          lifecycle: "COMPLETED",
          businessOutcome: "WON",
          createdBy: mockCommercialCreator.id
        }
      });

      vibe14Survey = await prisma.preContractSurvey.create({
        data: {
          caseId: vibe14WonCase.id,
          prospectiveSiteId: vibe14Site.id,
          companyId: "COMP-CL3-A",
          operationType: "SECURITY_GUARDING",
          lifecycle: "COMPLETED",
          responses: {
            create: [
              { elementCode: "HEADCOUNT", numericValue: 14 },
              { elementCode: "RELIEVER_REQUIRED", booleanValue: true }
            ]
          }
        }
      });
    });

    afterAll(async () => {
      if (vibe14ProposalId) {
        await prisma.workflowInstance.deleteMany({
          where: { referenceId: vibe14ProposalId, moduleType: "PRE_CONTRACT_PROPOSAL" }
        });
        await prisma.preContractProposalVersion.deleteMany({
          where: { proposalId: vibe14ProposalId }
        });
        await prisma.preContractProposal.deleteMany({
          where: { id: vibe14ProposalId }
        });
      }
      if (vibe14Estimate?.id) {
        await prisma.workflowInstance.deleteMany({
          where: { referenceId: vibe14Estimate.id, moduleType: "PRE_CONTRACT_COSTING" }
        });
        await prisma.preContractCostOverrideLog.deleteMany({
          where: { estimateVersion: { estimateId: vibe14Estimate.id } }
        });
        await prisma.preContractCostEstimateItem.deleteMany({
          where: { estimateVersion: { estimateId: vibe14Estimate.id } }
        });
        await prisma.preContractCostEstimateVersion.deleteMany({
          where: { estimateId: vibe14Estimate.id }
        });
        await prisma.preContractCostEstimate.deleteMany({
          where: { id: vibe14Estimate.id }
        });
      }
      if (vibe14Survey?.id) {
        await prisma.surveyResponse.deleteMany({ where: { surveyId: vibe14Survey.id } });
        await prisma.preContractSurvey.deleteMany({ where: { id: vibe14Survey.id } });
      }
      if (vibe14WonCase?.id) {
        await prisma.preContractCase.deleteMany({ where: { id: vibe14WonCase.id } });
      }
      if (vibe14Site?.id) {
        await prisma.preContractProspectiveSite.deleteMany({ where: { id: vibe14Site.id } });
      }
    });

    it("[VIBE14-01] Draft Costing line items save, reload in GET list and GET detail, and preserve Client/Site", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockCommercialCreator });

      // Create draft costing
      const createRes = await postCosting(
        new Request("http://localhost:3100/api/v1/commercial/costing", {
          method: "POST",
          body: JSON.stringify({
            caseId: vibe14WonCase.id,
            surveyId: vibe14Survey.id,
            pricingBasis: "MARGIN",
            targetMarginPercentage: 15.0
          })
        })
      );
      expect(createRes.status).toBe(201);
      const createData = await createRes.json();
      vibe14Estimate = createData.estimate;

      expect(vibe14Estimate.case?.prospectClient?.name).toBe("CL3 Test Client Comp A");
      expect(vibe14Estimate.survey?.prospectiveSite?.name).toBe("QP Tower A — VIBE14 Site");
      expect(vibe14Estimate.versions[0].items.length).toBeGreaterThan(0);

      // Reload via GET /api/v1/commercial/costing list (used when opening View / Edit from table)
      const listRes = await getCosting(
        new Request(`http://localhost:3100/api/v1/commercial/costing?caseId=${vibe14WonCase.id}`)
      );
      expect(listRes.status).toBe(200);
      const listData = await listRes.json();
      const reloadedFromList = listData.estimates.find((e: any) => e.id === vibe14Estimate.id);
      expect(reloadedFromList).toBeDefined();
      expect(reloadedFromList.case?.prospectClient?.name).toBe("CL3 Test Client Comp A");
      expect(reloadedFromList.survey?.prospectiveSite?.name).toBe("QP Tower A — VIBE14 Site");
      expect(Array.isArray(reloadedFromList.versions[0].items)).toBe(true);
      expect(reloadedFromList.versions[0].items.length).toBeGreaterThan(0);

      // Apply override via PATCH and verify Client, Site, and items are preserved
      const patchRes = await patchCostingDetail(
        new Request(`http://localhost:3100/api/v1/commercial/costing/${vibe14Estimate.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            overrides: [{ elementCode: "BASIC_PAY", unitRate: 2800, reason: "UAT rate calibration" }]
          })
        }),
        { params: { id: vibe14Estimate.id } }
      );
      expect(patchRes.status).toBe(200);
      const patchData = await patchRes.json();
      expect(patchData.estimate.case?.prospectClient?.name).toBe("CL3 Test Client Comp A");
      expect(patchData.estimate.survey?.prospectiveSite?.name).toBe("QP Tower A — VIBE14 Site");
      expect(patchData.estimate.versions[0].items.length).toBeGreaterThan(0);
    });

    it("[VIBE14-02] Costing SUBMIT and APPROVE preserve Client, Site, and line items (never turning into N/A)", async () => {
      // 1. SUBMIT as Creator
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockCommercialCreator });
      const submitRes = await postCostingWorkflow(
        new Request(`http://localhost:3100/api/v1/commercial/costing/${vibe14Estimate.id}/workflow`, {
          method: "POST",
          body: JSON.stringify({ action: "SUBMIT", remarks: "T1-007 Submit Costing" })
        }),
        { params: { id: vibe14Estimate.id } }
      );
      expect(submitRes.status).toBe(200);
      const submitData = await submitRes.json();
      expect(submitData.estimate.status).toBe("IN_WORKFLOW");
      expect(submitData.estimate.case?.prospectClient?.name).toBe("CL3 Test Client Comp A");
      expect(submitData.estimate.survey?.prospectiveSite?.name).toBe("QP Tower A — VIBE14 Site");
      expect(submitData.estimate.versions[0].items.length).toBeGreaterThan(0);

      // 2. APPROVE as Approver
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockProposalApprover });
      const approveRes = await postCostingWorkflow(
        new Request(`http://localhost:3100/api/v1/commercial/costing/${vibe14Estimate.id}/workflow`, {
          method: "POST",
          body: JSON.stringify({ action: "APPROVE", remarks: "T1-008 Approve Costing" })
        }),
        { params: { id: vibe14Estimate.id } }
      );
      expect(approveRes.status).toBe(200);
      const approveData = await approveRes.json();
      expect(approveData.estimate.status).toBe("APPROVED");
      expect(approveData.estimate.case?.prospectClient?.name).toBe("CL3 Test Client Comp A");
      expect(approveData.estimate.survey?.prospectiveSite?.name).toBe("QP Tower A — VIBE14 Site");
      expect(approveData.estimate.versions[0].status).toBe("APPROVED");
      expect(approveData.estimate.versions[0].items.length).toBeGreaterThan(0);

      vibe14ApprovedVersionId = approveData.estimate.versions[0].id;
    });

    it("[VIBE14-03] Proposal screen API (GET /api/v1/commercial/opportunities?forProposal=true) loads eligible WON opportunity with Customer, Site, and Approved Costing details, and enforces permissions & scope", async () => {
      // 1. Unauthorized user without precontract.proposal.manage is rejected with 403
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockNoPermUser });
      const unauthRes = await getOpportunities(
        new Request("http://localhost:3100/api/v1/commercial/opportunities?forProposal=true")
      );
      expect(unauthRes.status).toBe(403);

      // 2. FM-only user cannot see SG opportunity
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          ...mockFmUserCompA,
          permissions: ["precontract.proposal.manage"]
        }
      });
      const fmRes = await getOpportunities(
        new Request("http://localhost:3100/api/v1/commercial/opportunities?forProposal=true")
      );
      expect(fmRes.status).toBe(200);
      const fmData = await fmRes.json();
      expect(fmData.cases.find((c: any) => c.id === vibe14WonCase.id)).toBeUndefined();

      // 3. Company B user cannot see Company A opportunity
      (getServerSession as jest.Mock).mockResolvedValue({
        user: {
          ...mockSgUserCompB,
          permissions: ["precontract.proposal.manage"]
        }
      });
      const compBRes = await getOpportunities(
        new Request("http://localhost:3100/api/v1/commercial/opportunities?forProposal=true")
      );
      expect(compBRes.status).toBe(200);
      const compBData = await compBRes.json();
      expect(compBData.cases.find((c: any) => c.id === vibe14WonCase.id)).toBeUndefined();

      // 4. Authorized Commercial Creator loads eligible WON opportunity with Customer, Site, and Approved Costing
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockCommercialCreator });
      const creatorRes = await getOpportunities(
        new Request("http://localhost:3100/api/v1/commercial/opportunities?forProposal=true")
      );
      expect(creatorRes.status).toBe(200);
      const creatorData = await creatorRes.json();
      const matchedCase = creatorData.cases.find((c: any) => c.id === vibe14WonCase.id);
      expect(matchedCase).toBeDefined();
      expect(matchedCase.title).toBe("UAT-SG-T1-20260811-OPP");
      expect(matchedCase.lifecycle).toBe("COMPLETED");
      expect(matchedCase.businessOutcome).toBe("WON");
      expect(matchedCase.prospectClient?.name).toBe("CL3 Test Client Comp A");
      expect(matchedCase.surveys?.[0]?.prospectiveSite?.name).toBe("QP Tower A — VIBE14 Site");
      expect(matchedCase.costEstimates?.[0]?.versions?.[0]?.id).toBe(vibe14ApprovedVersionId);
      expect(matchedCase.costEstimates?.[0]?.versions?.[0]?.status).toBe("APPROVED");
      expect(typeof matchedCase.costEstimates?.[0]?.versions?.[0]?.sellingPrice).toBe("number");
    });

    it("[VIBE14-04] Proposal creation (POST /api/v1/commercial/proposals) rejects unauthorized users, ineligible cases, and forged/mismatched costing versions", async () => {
      // 1. Unauthorized user rejected (403)
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockNoPermUser });
      const unauthPost = await postProposals(
        new NextRequest("http://localhost:3100/api/v1/commercial/proposals", {
          method: "POST",
          body: JSON.stringify({
            caseId: vibe14WonCase.id,
            costEstimateVersionId: vibe14ApprovedVersionId
          })
        })
      );
      expect(unauthPost.status).toBe(403);

      // 2. Forged/mismatched caseId + costEstimateVersionId rejected (400)
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockCommercialCreator });
      const mismatchPost = await postProposals(
        new NextRequest("http://localhost:3100/api/v1/commercial/proposals", {
          method: "POST",
          body: JSON.stringify({
            caseId: testCaseCompA_SG.id, // Different case than vibe14WonCase!
            costEstimateVersionId: vibe14ApprovedVersionId
          })
        })
      );
      expect(mismatchPost.status).toBe(400);
      const mismatchData = await mismatchPost.json();
      expect(mismatchData.error).toContain("does not belong to the specified opportunity case");
    });

    it("[VIBE14-05] Proposal creation, submission (T1-009), and approval (T1-010) succeed end-to-end", async () => {
      // 1. Create Proposal as Commercial Creator
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockCommercialCreator });
      const createPropRes = await postProposals(
        new NextRequest("http://localhost:3100/api/v1/commercial/proposals", {
          method: "POST",
          body: JSON.stringify({
            caseId: vibe14WonCase.id,
            costEstimateVersionId: vibe14ApprovedVersionId,
            proposalCode: "UAT-SG-T1-20260811-PROPOSAL",
            title: "UAT-SG-T1-20260811-PROPOSAL",
            validityDays: 30
          })
        })
      );
      expect(createPropRes.status).toBe(201);
      const createPropData = await createPropRes.json();
      vibe14ProposalId = createPropData.proposal.id;
      expect(createPropData.proposal.status).toBe("DRAFT");
      expect(createPropData.dto.client?.name).toBe("CL3 Test Client Comp A");
      expect(createPropData.dto.opportunity?.title).toBe("UAT-SG-T1-20260811-OPP");

      // 2. Submit Proposal (T1-009)
      const submitPropRes = await postProposalWorkflow(
        new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${vibe14ProposalId}/workflow`, {
          method: "POST",
          body: JSON.stringify({ action: "SUBMIT", remarks: "T1-009 Proposal Submit" })
        }),
        { params: { id: vibe14ProposalId } }
      );
      expect(submitPropRes.status).toBe(200);
      const submitPropData = await submitPropRes.json();
      expect(submitPropData.proposal.status).toBe("IN_WORKFLOW");

      // 3. Approve Proposal (T1-010)
      (getServerSession as jest.Mock).mockResolvedValue({ user: mockProposalApprover });
      const approvePropRes = await postProposalWorkflow(
        new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${vibe14ProposalId}/workflow`, {
          method: "POST",
          body: JSON.stringify({ action: "APPROVE", remarks: "T1-010 Proposal Approve" })
        }),
        { params: { id: vibe14ProposalId } }
      );
      expect(approvePropRes.status).toBe(200);
      const approvePropData = await approvePropRes.json();
      expect(approvePropData.proposal.status).toBe("APPROVED_INTERNAL");
      expect(approvePropData.proposal.versions[0].status).toBe("APPROVED_INTERNAL");
      expect(approvePropData.proposal.versions[0].snapshotChecksum).toHaveLength(64);
    });

    it("[VIBE14-06] UI source verification: Quotations uses authoritative Opportunities API and Opportunity buttons do not conflict bg-white with text-white", () => {
      const quotationsPageSource = fs.readFileSync(
        path.resolve(__dirname, "../../apps/web/app/commercial/quotations/page.tsx"),
        "utf8"
      );
      expect(quotationsPageSource).toContain("/api/v1/commercial/opportunities?forProposal=true");
      expect(quotationsPageSource).not.toContain("/api/v1/commercial/crm/cases");

      const opportunitiesPageSource = fs.readFileSync(
        path.resolve(__dirname, "../../apps/web/app/commercial/opportunities/page.tsx"),
        "utf8"
      );
      // Confirm no Button with variant="secondary" overrides className with text-white
      expect(opportunitiesPageSource).not.toContain('bg-secondary text-white');
      expect(opportunitiesPageSource).not.toContain('bg-status-success text-white');
      expect(opportunitiesPageSource).not.toContain('bg-status-error text-white');
      expect(opportunitiesPageSource).toContain("Submit to Workflow");
      expect(opportunitiesPageSource).toContain("Review & Approve");
    });
  });
});
