import fs from "fs";
import path from "path";
import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";

import { POST as opportunityWorkflowRoute } from "../../apps/web/app/api/v1/commercial/opportunities/[id]/workflow/route";
import { POST as createSiteSurveyRoute } from "../../apps/web/app/api/v1/commercial/surveys/route";
import {
  canSubmitOpportunity,
  canApproveOpportunity,
} from "../../apps/web/lib/opportunity-workflow-helpers";
import { DEFAULT_ROLE_PERMISSIONS } from "../../apps/web/lib/permissions";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

describe("SG UAT Run 3 Day 1 Targeted Remediation (DEF-089, DEF-057, DEF-091, DEF-059)", () => {
  const rand = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  let testCompanyId: string;
  let testTemplateId: string;
  let prevDefaultTemplateIds: string[] = [];
  let ownOppId: string;
  let otherUserOppId: string;
  let adminSubmitOppId: string;
  let cancelledOppId: string;
  const createdSurveyIds: string[] = [];

  const creatorAId = `emp-r3-ca-${rand}`;
  const creatorBId = `emp-r3-cb-${rand}`;
  const approverId = `emp-r3-ap-${rand}`;
  const adminId = `emp-r3-ad-${rand}`;

  const creatorASession = () => ({
    id: creatorAId,
    employeeId: creatorAId,
    name: "Creator A",
    email: `creator-a-${rand}@test.local`,
    role: "COMMERCIAL_MAKER",
    companyId: testCompanyId,
    operationAccess: { allowedSecurityGuarding: true },
    permissions: [
      ...DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_MAKER,
      "precontract.workflow.submit",
      "precontract.case.manage",
      "precontract.workflow.approve", // even if user has approve perm, SoD must block self-approval
    ],
  });

  const creatorBSession = () => ({
    id: creatorBId,
    employeeId: creatorBId,
    name: "Creator B",
    email: `creator-b-${rand}@test.local`,
    role: "COMMERCIAL_MAKER",
    companyId: testCompanyId,
    operationAccess: { allowedSecurityGuarding: true },
    permissions: [
      ...DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_MAKER,
      "precontract.workflow.submit",
      "precontract.case.manage",
    ],
  });

  const approverSession = () => ({
    id: approverId,
    employeeId: approverId,
    name: "Assigned Approver",
    email: `approver-${rand}@test.local`,
    role: "COMMERCIAL_CHECKER",
    companyId: testCompanyId,
    operationAccess: { allowedSecurityGuarding: true },
    permissions: [
      ...DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_CHECKER,
      "precontract.workflow.approve",
      "precontract.workflow.review",
    ],
  });

  const adminSession = () => ({
    id: adminId,
    employeeId: adminId,
    name: "Commercial Admin",
    email: `admin-${rand}@test.local`,
    role: "ADMIN",
    companyId: testCompanyId,
    operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true },
    permissions: DEFAULT_ROLE_PERMISSIONS.ADMIN,
  });

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: {
        companyCode: `SGR3-${rand}`,
        companyName: `SG Run3 Test Company ${rand}`,
        isActive: true,
      },
    });
    testCompanyId = company.id;

    // Ensure deterministic workflow template resolution for PRE_CONTRACT_CASE
    const prevDefaults = await prisma.workflowTemplate.findMany({
      where: {
        isActive: true,
        isDefault: true,
        OR: [{ moduleType: "PRE_CONTRACT_CASE" }, { moduleType: "COMMERCIAL_OPPORTUNITY" }],
      },
      select: { id: true },
    });
    prevDefaultTemplateIds = prevDefaults.map((t) => t.id);
    if (prevDefaultTemplateIds.length > 0) {
      await prisma.workflowTemplate.updateMany({
        where: { id: { in: prevDefaultTemplateIds } },
        data: { isDefault: false },
      });
    }

    const template = await prisma.workflowTemplate.create({
      data: {
        workflowName: `SG Run3 Opportunity Approval ${rand}`,
        moduleType: "PRE_CONTRACT_CASE",
        appliesTo: "ACTIVATION",
        operationType: "SECURITY_GUARDING",
        isDefault: true,
        isActive: true,
        levels: {
          create: [
            {
              levelNumber: 1,
              levelName: "Commercial Checker Approval",
              approvalRule: "ANY_ONE",
              isMandatory: true,
              approvers: {
                create: [
                  {
                    approverType: "SPECIFIC_EMPLOYEE",
                    employeeId: approverId,
                    employeeName: "Assigned Approver",
                  },
                ],
              },
            },
          ],
        },
      },
    });
    testTemplateId = template.id;

    const oppOwn = await prisma.preContractCase.create({
      data: {
        title: `Run3 Own Opportunity ${rand}`,
        companyId: testCompanyId,
        operationType: "SECURITY_GUARDING",
        lifecycle: "DRAFT",
        businessOutcome: "IN_PROGRESS",
        createdBy: creatorAId,
      },
    });
    ownOppId = oppOwn.id;

    const oppOther = await prisma.preContractCase.create({
      data: {
        title: `Run3 Other User Opportunity ${rand}`,
        companyId: testCompanyId,
        operationType: "SECURITY_GUARDING",
        lifecycle: "DRAFT",
        businessOutcome: "IN_PROGRESS",
        createdBy: creatorAId,
      },
    });
    otherUserOppId = oppOther.id;

    const oppAdmin = await prisma.preContractCase.create({
      data: {
        title: `Run3 Admin Delegated Submit Opportunity ${rand}`,
        companyId: testCompanyId,
        operationType: "SECURITY_GUARDING",
        lifecycle: "DRAFT",
        businessOutcome: "IN_PROGRESS",
        createdBy: creatorAId,
      },
    });
    adminSubmitOppId = oppAdmin.id;

    const oppCancelled = await prisma.preContractCase.create({
      data: {
        title: `Run3 Cancelled Opportunity ${rand}`,
        companyId: testCompanyId,
        operationType: "SECURITY_GUARDING",
        lifecycle: "CANCELLED",
        businessOutcome: "LOST",
        createdBy: creatorAId,
      },
    });
    cancelledOppId = oppCancelled.id;
  });

  afterAll(async () => {
    try {
      if (createdSurveyIds.length > 0) {
        await prisma.surveyResponse.deleteMany({
          where: { surveyId: { in: createdSurveyIds } },
        });
        await prisma.surveyConfigurationSnapshot.deleteMany({
          where: { surveyId: { in: createdSurveyIds } },
        });
        await prisma.preContractSurvey.deleteMany({
          where: { id: { in: createdSurveyIds } },
        });
      }
      await prisma.workflowInstance.deleteMany({
        where: {
          referenceId: { in: [ownOppId, otherUserOppId, adminSubmitOppId, cancelledOppId] },
        },
      });
      await prisma.preContractCase.deleteMany({
        where: {
          id: { in: [ownOppId, otherUserOppId, adminSubmitOppId, cancelledOppId] },
        },
      });
      await prisma.workflowTemplate.deleteMany({
        where: { id: testTemplateId },
      });
      if (prevDefaultTemplateIds.length > 0) {
        await prisma.workflowTemplate.updateMany({
          where: { id: { in: prevDefaultTemplateIds } },
          data: { isDefault: true },
        });
      }
      await prisma.company.deleteMany({
        where: { id: testCompanyId },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  it("1. Creator submitting own opportunity is allowed (200)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: creatorASession() });
    const req = new Request(`http://localhost:3100/api/v1/commercial/opportunities/${ownOppId}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SUBMIT", remarks: "Submitting own opportunity" }),
    });
    const res = await opportunityWorkflowRoute(req, { params: { id: ownOppId } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.case.lifecycle).toBe("IN_WORKFLOW");
  });

  it("2. Creator submitting another user's opportunity is blocked (403)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: creatorBSession() });
    const req = new Request(`http://localhost:3100/api/v1/commercial/opportunities/${otherUserOppId}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SUBMIT", remarks: "Unauthorized cross-user submit" }),
    });
    const res = await opportunityWorkflowRoute(req, { params: { id: otherUserOppId } });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("only submit commercial opportunities that you created");
  });

  it("3. Authorized administrative submission on behalf of another user is allowed (200)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: adminSession() });
    const req = new Request(`http://localhost:3100/api/v1/commercial/opportunities/${adminSubmitOppId}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SUBMIT", remarks: "Admin delegated submit" }),
    });
    const res = await opportunityWorkflowRoute(req, { params: { id: adminSubmitOppId } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.case.lifecycle).toBe("IN_WORKFLOW");
  });

  it("4. Creator approving own opportunity is blocked by SoD (403)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: creatorASession() });
    const req = new Request(`http://localhost:3100/api/v1/commercial/opportunities/${ownOppId}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "APPROVE", remarks: "Self approval attempt" }),
    });
    const res = await opportunityWorkflowRoute(req, { params: { id: ownOppId } });
    expect(res.status).toBe(403);
  });

  it("5. Assigned Approver approval is allowed (200)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: approverSession() });
    const req = new Request(`http://localhost:3100/api/v1/commercial/opportunities/${ownOppId}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "APPROVE", remarks: "Approved by assigned checker" }),
    });
    const res = await opportunityWorkflowRoute(req, { params: { id: ownOppId } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.case.lifecycle).toBe("COMPLETED");
  });

  it("6. Unauthorized submit & approval buttons are hidden by shared helpers (DEF-089 & DEF-057)", () => {
    const oppOwnedByA = { createdBy: creatorAId };

    // Submit visibility
    expect(canSubmitOpportunity(creatorASession(), oppOwnedByA)).toBe(true);
    expect(canSubmitOpportunity(creatorBSession(), oppOwnedByA)).toBe(false);
    expect(canSubmitOpportunity(adminSession(), oppOwnedByA)).toBe(true);

    // Approval visibility: Creator hidden (even if user is SUPER_ADMIN!)
    expect(canApproveOpportunity(creatorASession(), oppOwnedByA)).toBe(false);
    expect(
      canApproveOpportunity(
        { id: creatorAId, email: `creator-a-${rand}@test.local`, role: "SUPER_ADMIN" },
        oppOwnedByA
      )
    ).toBe(false);
    expect(canApproveOpportunity(creatorBSession(), oppOwnedByA)).toBe(false);
    expect(canApproveOpportunity(approverSession(), oppOwnedByA)).toBe(true);
  });

  it("7. Opportunities page replaces window.alert() with inline error banners and resets Processing state (DEF-091)", () => {
    const pagePath = path.resolve(__dirname, "../../apps/web/app/commercial/opportunities/page.tsx");
    const source = fs.readFileSync(pagePath, "utf8");
    expect(source).not.toMatch(/\balert\(/);
    expect(source).toContain("setWorkflowError(");
    expect(source).toContain("setCreateError(");
    expect(source).toContain('role="alert"');
    expect(source).toContain("setWorkflowExecuting(false)");
    expect(source).toContain("setSubmitting(false)");
  });

  it("8. Existing Site Survey eligibility remains unchanged: DRAFT & IN_WORKFLOW allowed, CANCELLED rejected (DEF-059)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: adminSession() });

    // DRAFT opportunity allowed
    const draftReq = new Request("http://localhost:3100/api/v1/commercial/surveys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caseId: otherUserOppId,
        siteName: `Run3 Draft Survey Site ${rand}`,
        siteAddress: "Doha Test Address 1",
        operationType: "SECURITY_GUARDING",
      }),
    });
    const draftRes = await createSiteSurveyRoute(draftReq);
    expect(draftRes.status).toBe(201);
    const draftData = await draftRes.json();
    createdSurveyIds.push(draftData.survey.id);

    // IN_WORKFLOW opportunity allowed
    const wfReq = new Request("http://localhost:3100/api/v1/commercial/surveys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caseId: adminSubmitOppId,
        siteName: `Run3 Workflow Survey Site ${rand}`,
        siteAddress: "Doha Test Address 2",
        operationType: "SECURITY_GUARDING",
      }),
    });
    const wfRes = await createSiteSurveyRoute(wfReq);
    expect(wfRes.status).toBe(201);
    const wfData = await wfRes.json();
    createdSurveyIds.push(wfData.survey.id);

    // CANCELLED opportunity rejected (400)
    const cancelReq = new Request("http://localhost:3100/api/v1/commercial/surveys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caseId: cancelledOppId,
        siteName: `Run3 Cancelled Survey Site ${rand}`,
        operationType: "SECURITY_GUARDING",
      }),
    });
    const cancelRes = await createSiteSurveyRoute(cancelReq);
    expect(cancelRes.status).toBe(400);
  });
});
