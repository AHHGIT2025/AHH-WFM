import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { NextRequest } from "next/server";

import { POST as opportunityWorkflowRoute } from "../../apps/web/app/api/v1/commercial/opportunities/[id]/workflow/route";
import { POST as createSiteSurveyRoute, GET as getSiteSurveysRoute } from "../../apps/web/app/api/v1/commercial/surveys/route";
import { PATCH as patchSiteSurveyRoute, GET as getSiteSurveyDetailRoute } from "../../apps/web/app/api/v1/commercial/surveys/[id]/route";
import { POST as surveyWorkflowRoute } from "../../apps/web/app/api/v1/commercial/surveys/[id]/workflow/route";
import { POST as createCostingRoute } from "../../apps/web/app/api/v1/commercial/costing/route";
import { POST as approveAddendumRoute } from "../../apps/web/app/api/v1/commercial/contracts/[contractId]/addendums/[addendumId]/approve/route";
import { GET as getApprovalsInboxRoute } from "../../apps/web/app/api/v1/approvals/route";
import { POST as executeApprovalActionRoute } from "../../apps/web/app/api/v1/approvals/[id]/action/route";
import { WorkflowAdapterRegistry } from "../../apps/web/lib/workflow/adapters/registry";
import { DEFAULT_ROLE_PERMISSIONS } from "../../apps/web/lib/permissions";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

describe("SG UAT Run 3 Day 2 Remediation Suite (TEST DATABASE)", () => {
  const rand = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  let companyAId: string;
  let companyBId: string;
  let oppTemplateId: string;
  let survey1LvlTemplateId: string;
  let survey2LvlTemplateId: string;
  let addendumTemplateId: string;
  let prevOppDefaultIds: string[] = [];
  let prevSurveyDefaultIds: string[] = [];
  let prevAddendumDefaultIds: string[] = [];

  const creatorId = `emp-r3d2-cr-${rand}`;
  const approver1Id = `emp-r3d2-a1-${rand}`;
  const approver2Id = `emp-r3d2-a2-${rand}`;
  const otherMakerId = `emp-r3d2-om-${rand}`;
  const companyBUserId = `emp-r3d2-cb-${rand}`;

  let oppId: string;
  let oppModuleId: string;
  let survey1Id: string;
  let survey2Id: string;
  let surveyMultiId: string;
  let testClientId: string;
  let testContractId: string;
  let testAddendumId: string;
  const createdCostingIds: string[] = [];
  const createdProspectiveSiteIds: string[] = [];

  const creatorSession = () => ({
    id: creatorId,
    employeeId: creatorId,
    name: "Shana Creator",
    email: `creator-${rand}@test.local`,
    role: "COMMERCIAL_MAKER",
    companyId: companyAId,
    operationAccess: { allowedSecurityGuarding: true },
    permissions: [
      ...DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_MAKER,
      "precontract.workflow.submit",
      "precontract.case.manage",
      "commercial.surveys.manage",
      "precontract.costing.manage",
    ],
  });

  const otherMakerSession = () => ({
    id: otherMakerId,
    employeeId: otherMakerId,
    name: "Other Maker",
    email: `othermaker-${rand}@test.local`,
    role: "COMMERCIAL_MAKER",
    companyId: companyAId,
    operationAccess: { allowedSecurityGuarding: true },
    permissions: [
      ...DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_MAKER,
      "precontract.workflow.submit",
    ],
  });

  const approver1Session = () => ({
    id: approver1Id,
    employeeId: approver1Id,
    name: "Checker Level 1",
    email: `approver1-${rand}@test.local`,
    role: "COMMERCIAL_CHECKER",
    companyId: companyAId,
    operationAccess: { allowedSecurityGuarding: true },
    permissions: [
      ...DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_CHECKER,
      "precontract.workflow.approve",
      "precontract.workflow.review",
      "precontract.workflow.reject",
    ],
  });

  const approver2Session = () => ({
    id: approver2Id,
    employeeId: approver2Id,
    name: "Director Level 2",
    email: `approver2-${rand}@test.local`,
    role: "COMMERCIAL_CHECKER",
    companyId: companyAId,
    operationAccess: { allowedSecurityGuarding: true },
    permissions: [
      ...DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_CHECKER,
      "precontract.workflow.approve",
      "precontract.workflow.review",
    ],
  });

  const companyBSession = () => ({
    id: companyBUserId,
    employeeId: companyBUserId,
    name: "Company B User",
    email: `compb-${rand}@test.local`,
    role: "COMMERCIAL_CHECKER",
    companyId: companyBId,
    operationAccess: { allowedSecurityGuarding: true },
    permissions: DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_CHECKER,
  });

  beforeAll(async () => {
    const compA = await prisma.company.create({
      data: { companyCode: `R3D2A-${rand}`, companyName: `Run3 Day2 Co A ${rand}`, isActive: true },
    });
    companyAId = compA.id;

    const compB = await prisma.company.create({
      data: { companyCode: `R3D2B-${rand}`, companyName: `Run3 Day2 Co B ${rand}`, isActive: true },
    });
    companyBId = compB.id;

    await prisma.employee.createMany({
      data: [
        { id: creatorId, name: "Shana Creator", department: "Commercial", companyId: companyAId, role: "EMPLOYEE", status: "On Duty", email: `creator-${rand}@test.local` },
        { id: approver1Id, name: "Checker Level 1", department: "Commercial", companyId: companyAId, role: "SUPERVISOR", status: "On Duty", email: `approver1-${rand}@test.local` },
        { id: approver2Id, name: "Director Level 2", department: "Executive", companyId: companyAId, role: "SUPERVISOR", status: "On Duty", email: `approver2-${rand}@test.local` },
        { id: otherMakerId, name: "Other Maker", department: "Commercial", companyId: companyAId, role: "EMPLOYEE", status: "On Duty", email: `othermaker-${rand}@test.local` },
        { id: companyBUserId, name: "Company B User", department: "Commercial", companyId: companyBId, role: "SUPERVISOR", status: "On Duty", email: `compb-${rand}@test.local` },
      ],
    });

    const prevOppDefs = await prisma.workflowTemplate.findMany({
      where: { isActive: true, isDefault: true, OR: [{ moduleType: "PRE_CONTRACT_CASE" }, { moduleType: "COMMERCIAL_OPPORTUNITY" }] },
      select: { id: true },
    });
    prevOppDefaultIds = prevOppDefs.map((t) => t.id);
    if (prevOppDefaultIds.length > 0) {
      await prisma.workflowTemplate.updateMany({ where: { id: { in: prevOppDefaultIds } }, data: { isDefault: false } });
    }

    const prevSrvDefs = await prisma.workflowTemplate.findMany({
      where: { isActive: true, isDefault: true, moduleType: "SITE_SURVEY" },
      select: { id: true },
    });
    prevSurveyDefaultIds = prevSrvDefs.map((t) => t.id);
    if (prevSurveyDefaultIds.length > 0) {
      await prisma.workflowTemplate.updateMany({ where: { id: { in: prevSurveyDefaultIds } }, data: { isDefault: false } });
    }

    const oppTpl = await prisma.workflowTemplate.create({
      data: {
        workflowName: `Run3 Day2 Opportunity Approval ${rand}`,
        moduleType: "PRE_CONTRACT_CASE",
        appliesTo: "ACTIVATION",
        operationType: "SECURITY_GUARDING",
        isDefault: true,
        isActive: true,
        levels: {
          create: [
            {
              levelNumber: 1,
              levelName: "Commercial Checker",
              approvalRule: "ANY_ONE",
              isMandatory: true,
              approvers: { create: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: approver1Id, employeeName: "Checker Level 1" }] },
            },
          ],
        },
      },
    });
    oppTemplateId = oppTpl.id;

    const srv1Tpl = await prisma.workflowTemplate.create({
      data: {
        workflowName: `Run3 Day2 Survey 1-Level ${rand}`,
        moduleType: "SITE_SURVEY",
        appliesTo: "ACTIVATION",
        operationType: "SECURITY_GUARDING",
        isDefault: true,
        isActive: true,
        levels: {
          create: [
            {
              levelNumber: 1,
              levelName: "Technical Checker",
              approvalRule: "ANY_ONE",
              isMandatory: true,
              approvers: { create: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: approver1Id, employeeName: "Checker Level 1" }] },
            },
          ],
        },
      },
    });
    survey1LvlTemplateId = srv1Tpl.id;

    const srv2Tpl = await prisma.workflowTemplate.create({
      data: {
        workflowName: `Run3 Day2 Survey 2-Level ${rand}`,
        moduleType: "SITE_SURVEY",
        appliesTo: "ACTIVATION",
        operationType: "SECURITY_GUARDING",
        isDefault: false,
        isActive: true,
        levels: {
          create: [
            {
              levelNumber: 1,
              levelName: "Technical Checker",
              approvalRule: "ANY_ONE",
              isMandatory: true,
              approvers: { create: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: approver1Id, employeeName: "Checker Level 1" }] },
            },
            {
              levelNumber: 2,
              levelName: "Operations Director",
              approvalRule: "ANY_ONE",
              isMandatory: true,
              approvers: { create: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: approver2Id, employeeName: "Director Level 2" }] },
            },
          ],
        },
      },
    });
    survey2LvlTemplateId = srv2Tpl.id;

    const opp = await prisma.preContractCase.create({
      data: {
        title: `OPP3 Run3 Day2 Deal ${rand}`,
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        lifecycle: "DRAFT",
        businessOutcome: "IN_PROGRESS",
        createdBy: creatorId,
      },
    });
    oppId = opp.id;

    const oppMod = await prisma.preContractCase.create({
      data: {
        title: `OPP-MOD Run3 Day2 Deal ${rand}`,
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        lifecycle: "DRAFT",
        businessOutcome: "IN_PROGRESS",
        createdBy: creatorId,
      },
    });
    oppModuleId = oppMod.id;

    const prevAddDefs = await prisma.workflowTemplate.findMany({
      where: { isActive: true, isDefault: true, moduleType: "CONTRACT_ADDENDUM" },
      select: { id: true },
    });
    prevAddendumDefaultIds = prevAddDefs.map((t) => t.id);
    if (prevAddendumDefaultIds.length > 0) {
      await prisma.workflowTemplate.updateMany({ where: { id: { in: prevAddendumDefaultIds } }, data: { isDefault: false } });
    }

    const addTpl = await prisma.workflowTemplate.create({
      data: {
        workflowName: `Run3 Day2 Addendum Approval ${rand}`,
        moduleType: "CONTRACT_ADDENDUM",
        appliesTo: "ACTIVATION",
        operationType: "SECURITY_GUARDING",
        isDefault: true,
        isActive: true,
        levels: {
          create: [
            {
              levelNumber: 1,
              levelName: "Commercial Checker",
              approvalRule: "ANY_ONE",
              isMandatory: true,
              approvers: { create: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: approver1Id, employeeName: "Checker Level 1" }] },
            },
          ],
        },
      },
    });
    addendumTemplateId = addTpl.id;

    const client = await prisma.manpowerClient.create({
      data: {
        code: `CLR3D2-${rand}`,
        name: `Run3 Day2 Client ${rand}`,
        operationType: "SECURITY_GUARDING",
        isActive: true,
      },
    });
    testClientId = client.id;

    const contract = await prisma.manpowerContract.create({
      data: {
        clientId: testClientId,
        contractNumber: `CON-R3D2-${rand}`,
        title: "Run3 Day2 Active Contract",
        startDate: new Date("2026-09-01"),
        endDate: new Date("2027-08-31"),
        totalContractValue: 100000,
        operationType: "SECURITY_GUARDING",
        status: "ACTIVE",
        approvalStatus: "APPROVED",
        mobilisationStatus: "MOBILISED",
      },
    });
    testContractId = contract.id;

    const addendum = await prisma.manpowerContractAddendum.create({
      data: {
        contractId: testContractId,
        addendumNumber: `ADD-R3D2-${rand}`,
        title: "Run3 Day2 Addendum",
        addendumDate: new Date(),
        effectiveFrom: new Date("2026-10-01"),
        effectiveTo: new Date("2027-08-31"),
        addendumType: "MANPOWER_ADDITION",
        calculatedCommercialImpact: 25000,
        status: "PENDING_APPROVAL",
      },
    });
    testAddendumId = addendum.id;
  });

  afterAll(async () => {
    try {
      const surveyIds = [survey1Id, survey2Id, surveyMultiId].filter(Boolean);
      if (createdCostingIds.length > 0) {
        await prisma.preContractCostEstimateVersion.deleteMany({
          where: { estimateId: { in: createdCostingIds } },
        });
        await prisma.preContractCostEstimate.deleteMany({
          where: { id: { in: createdCostingIds } },
        });
      }
      if (surveyIds.length > 0) {
        await prisma.surveyResponse.deleteMany({ where: { surveyId: { in: surveyIds } } });
        await prisma.surveyConfigurationSnapshot.deleteMany({ where: { surveyId: { in: surveyIds } } });
        await prisma.workflowInstance.deleteMany({ where: { referenceId: { in: surveyIds } } });
        await prisma.preContractSurvey.deleteMany({ where: { id: { in: surveyIds } } });
      }
      if (createdProspectiveSiteIds.length > 0) {
        await prisma.preContractProspectiveSite.deleteMany({ where: { id: { in: createdProspectiveSiteIds } } });
      }
      await prisma.workflowInstance.deleteMany({ where: { referenceId: { in: [oppId, oppModuleId, testAddendumId].filter(Boolean) } } });
      if (testAddendumId) {
        await prisma.manpowerContractAddendum.deleteMany({ where: { id: testAddendumId } });
      }
      if (testContractId) {
        await prisma.manpowerContract.deleteMany({ where: { id: testContractId } });
      }
      if (testClientId) {
        await prisma.manpowerClient.deleteMany({ where: { id: testClientId } });
      }
      await prisma.preContractCase.deleteMany({ where: { id: { in: [oppId, oppModuleId].filter(Boolean) } } });
      await prisma.workflowTemplate.deleteMany({
        where: { id: { in: [oppTemplateId, survey1LvlTemplateId, survey2LvlTemplateId, addendumTemplateId].filter(Boolean) } },
      });
      if (prevOppDefaultIds.length > 0) {
        await prisma.workflowTemplate.updateMany({ where: { id: { in: prevOppDefaultIds } }, data: { isDefault: true } });
      }
      if (prevSurveyDefaultIds.length > 0) {
        await prisma.workflowTemplate.updateMany({ where: { id: { in: prevSurveyDefaultIds } }, data: { isDefault: true } });
      }
      if (prevAddendumDefaultIds.length > 0) {
        await prisma.workflowTemplate.updateMany({ where: { id: { in: prevAddendumDefaultIds } }, data: { isDefault: true } });
      }
      await prisma.employee.deleteMany({
        where: { id: { in: [creatorId, approver1Id, approver2Id, otherMakerId, companyBUserId] } },
      });
      await prisma.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it("1. Opportunity SUBMIT -> Approval Center APPROVE -> lifecycle COMPLETED & WON; duplicate approval rejected (DEF-094)", async () => {
    // Unauthorized cross-user submit blocked (403)
    (getServerSession as jest.Mock).mockResolvedValue({ user: otherMakerSession() });
    const badSubmitRes = await opportunityWorkflowRoute(
      new Request(`http://localhost:3100/api/v1/commercial/opportunities/${oppId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT" }),
      }),
      { params: { id: oppId } }
    );
    expect(badSubmitRes.status).toBe(403);

    // Creator submits own opportunity
    (getServerSession as jest.Mock).mockResolvedValue({ user: creatorSession() });
    const submitRes = await opportunityWorkflowRoute(
      new Request(`http://localhost:3100/api/v1/commercial/opportunities/${oppId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT", remarks: "Submitting OPP3" }),
      }),
      { params: { id: oppId } }
    );
    expect(submitRes.status).toBe(200);
    const submitData = await submitRes.json();
    const instanceId = submitData.workflow.instanceId;

    // Cross-company user cannot approve via Approval Center (403)
    (getServerSession as jest.Mock).mockResolvedValue({ user: companyBSession() });
    const compBRes = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${instanceId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "Cross-company attempt" }),
      }),
      { params: { id: instanceId } }
    );
    expect(compBRes.status).toBe(403);

    // Creator cannot self-approve via Approval Center (403)
    (getServerSession as jest.Mock).mockResolvedValue({ user: creatorSession() });
    const selfRes = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${instanceId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "Self approval attempt" }),
      }),
      { params: { id: instanceId } }
    );
    expect(selfRes.status).toBe(403);

    // Assigned Approver approves via Approval Center -> Case becomes COMPLETED & WON
    (getServerSession as jest.Mock).mockResolvedValue({ user: approver1Session() });
    const approveRes = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${instanceId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "Approved via Approval Center" }),
      }),
      { params: { id: instanceId } }
    );
    expect(approveRes.status).toBe(200);

    const updatedOpp = await prisma.preContractCase.findUnique({ where: { id: oppId } });
    expect(updatedOpp?.lifecycle).toBe("COMPLETED");
    expect(updatedOpp?.businessOutcome).toBe("IN_PROGRESS"); // Correction 1: never auto-set WON on internal approval

    // Module-direct opportunity approval also sets COMPLETED without WON
    (getServerSession as jest.Mock).mockResolvedValue({ user: creatorSession() });
    const modSubRes = await opportunityWorkflowRoute(
      new Request(`http://localhost:3100/api/v1/commercial/opportunities/${oppModuleId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT" }),
      }),
      { params: { id: oppModuleId } }
    );
    expect(modSubRes.status).toBe(200);

    (getServerSession as jest.Mock).mockResolvedValue({ user: approver1Session() });
    const modAppRes = await opportunityWorkflowRoute(
      new Request(`http://localhost:3100/api/v1/commercial/opportunities/${oppModuleId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "Module-direct approval" }),
      }),
      { params: { id: oppModuleId } }
    );
    expect(modAppRes.status).toBe(200);

    const updatedModOpp = await prisma.preContractCase.findUnique({ where: { id: oppModuleId } });
    expect(updatedModOpp?.lifecycle).toBe("COMPLETED");
    expect(updatedModOpp?.businessOutcome).toBe("IN_PROGRESS");

    // Duplicate approval on completed workflow is rejected (409)
    const dupRes = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${instanceId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "Duplicate" }),
      }),
      { params: { id: instanceId } }
    );
    expect(dupRes.status).toBe(409);
  });

  it("2. Survey SUBMIT -> Approval Center display mapping (DEF-095) -> APPROVE -> COMPLETED -> Costing eligible & duplicate costing blocked (DEF-093, DEF-098)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: creatorSession() });
    const createRes = await createSiteSurveyRoute(
      new Request("http://localhost:3100/api/v1/commercial/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: oppId,
          siteName: `QP Tower A R3 ${rand}`,
          operationType: "SECURITY_GUARDING",
          conductedBy: creatorId,
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const createdSurvey = (await createRes.json()).survey;
    survey1Id = createdSurvey.id;
    if (createdSurvey.prospectiveSiteId) createdProspectiveSiteIds.push(createdSurvey.prospectiveSiteId);

    // Costing rejects DRAFT survey (400)
    const draftCostRes = await createCostingRoute(
      new Request("http://localhost:3100/api/v1/commercial/costing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: oppId, surveyId: survey1Id }),
      })
    );
    expect(draftCostRes.status).toBe(400);

    // Submit Survey
    const subRes = await surveyWorkflowRoute(
      new Request(`http://localhost:3100/api/v1/commercial/surveys/${survey1Id}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT" }),
      }),
      { params: { id: survey1Id } }
    );
    expect(subRes.status).toBe(200);
    const instanceId = (await subRes.json()).workflow.instanceId;

    // Verify Approval Center Inbox shows meaningful title & resolved requester name (DEF-095)
    (getServerSession as jest.Mock).mockResolvedValue({ user: approver1Session() });
    const inboxRes = await getApprovalsInboxRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals?tab=inbox&pageSize=100&search=${encodeURIComponent(`QP Tower A R3 ${rand}`)}`)
    );
    expect(inboxRes.status).toBe(200);
    const inboxItem = (await inboxRes.json()).data.find((i: any) => i.sourceId === survey1Id);
    expect(inboxItem).toBeTruthy();
    expect(inboxItem.subject).toContain(`QP Tower A R3 ${rand}`);
    expect(inboxItem.subject).not.toContain(`Request ${survey1Id}`);
    expect(inboxItem.requesterName).toBe("Shana Creator");

    // Approve via Approval Center -> Survey becomes COMPLETED (DEF-093)
    const approveRes = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${instanceId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "Survey approved in Approval Center" }),
      }),
      { params: { id: instanceId } }
    );
    expect(approveRes.status).toBe(200);

    const updatedSurvey = await prisma.preContractSurvey.findUnique({ where: { id: survey1Id } });
    expect(updatedSurvey?.lifecycle).toBe("COMPLETED");

    // Survey counters updated
    (getServerSession as jest.Mock).mockResolvedValue({ user: creatorSession() });
    const listRes = await getSiteSurveysRoute(new Request(`http://localhost:3100/api/v1/commercial/surveys?caseId=${oppId}`));
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.summaryStats.approvedCount).toBeGreaterThanOrEqual(1);

    // Approved survey cannot be edited (immutable, 400)
    const editApprovedRes = await patchSiteSurveyRoute(
      new Request(`http://localhost:3100/api/v1/commercial/surveys/${survey1Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses: [{ elementCode: "ELEM_POST_COUNT", numericValue: 99 }] }),
      }),
      { params: { id: survey1Id } }
    );
    expect(editApprovedRes.status).toBe(400);

    // Costing succeeds for COMPLETED survey (201) and blocks duplicate active costing (409, DEF-098)
    const costRes = await createCostingRoute(
      new Request("http://localhost:3100/api/v1/commercial/costing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: oppId, surveyId: survey1Id }),
      })
    );
    expect(costRes.status).toBe(201);
    const costData = await costRes.json();
    createdCostingIds.push(costData.estimate.id);

    const dupCostRes = await createCostingRoute(
      new Request("http://localhost:3100/api/v1/commercial/costing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: oppId, surveyId: survey1Id }),
      })
    );
    expect(dupCostRes.status).toBe(409);
  });

  it("3. Survey SUBMIT -> RETURN -> Creator EDIT & SAVE -> RESUBMIT -> APPROVE retains full audit history (DEF-092)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: creatorSession() });
    const createRes = await createSiteSurveyRoute(
      new Request("http://localhost:3100/api/v1/commercial/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: oppId,
          siteName: `QP Tower A Return ${rand}`,
          operationType: "SECURITY_GUARDING",
          conductedBy: creatorId,
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const srv = (await createRes.json()).survey;
    survey2Id = srv.id;
    if (srv.prospectiveSiteId) createdProspectiveSiteIds.push(srv.prospectiveSiteId);

    const sub1Res = await surveyWorkflowRoute(
      new Request(`http://localhost:3100/api/v1/commercial/surveys/${survey2Id}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT" }),
      }),
      { params: { id: survey2Id } }
    );
    expect(sub1Res.status).toBe(200);
    const instanceId = (await sub1Res.json()).workflow.instanceId;

    // Return via Approval Center
    (getServerSession as jest.Mock).mockResolvedValue({ user: approver1Session() });
    const retRes = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${instanceId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RETURN", remarks: "Please clarify post count" }),
      }),
      { params: { id: instanceId } }
    );
    expect(retRes.status).toBe(200);

    const returnedSurvey = await prisma.preContractSurvey.findUnique({ where: { id: survey2Id } });
    expect(returnedSurvey?.lifecycle).toBe("DRAFT");

    // Creator edits & saves returned survey
    (getServerSession as jest.Mock).mockResolvedValue({ user: creatorSession() });
    const patchRes = await patchSiteSurveyRoute(
      new Request(`http://localhost:3100/api/v1/commercial/surveys/${survey2Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses: [{ elementCode: "ELEM_POST_COUNT", numericValue: 8 }] }),
      }),
      { params: { id: survey2Id } }
    );
    expect(patchRes.status).toBe(200);

    // Creator resubmits & Approver approves
    const sub2Res = await surveyWorkflowRoute(
      new Request(`http://localhost:3100/api/v1/commercial/surveys/${survey2Id}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT", remarks: "Updated post count to 8" }),
      }),
      { params: { id: survey2Id } }
    );
    expect(sub2Res.status).toBe(200);

    (getServerSession as jest.Mock).mockResolvedValue({ user: approver1Session() });
    const app2Res = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${instanceId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "Correction verified" }),
      }),
      { params: { id: instanceId } }
    );
    expect(app2Res.status).toBe(200);

    const detailRes = await getSiteSurveyDetailRoute(
      new Request(`http://localhost:3100/api/v1/commercial/surveys/${survey2Id}`),
      { params: { id: survey2Id } }
    );
    expect(detailRes.status).toBe(200);
    const detail = await detailRes.json();
    expect(detail.survey.lifecycle).toBe("COMPLETED");
    const actions = detail.workflowInstance.history.map((h: any) => h.action);
    expect(actions).toEqual(["SUBMIT", "RETURN", "SUBMIT", "APPROVE"]);
  });

  it("4. Multi-level Survey approval does NOT complete prematurely on Level 1; completes on Level 2", async () => {
    // Temporarily make 2-level template default for this test
    await prisma.workflowTemplate.update({ where: { id: survey1LvlTemplateId }, data: { isDefault: false } });
    await prisma.workflowTemplate.update({ where: { id: survey2LvlTemplateId }, data: { isDefault: true } });

    (getServerSession as jest.Mock).mockResolvedValue({ user: creatorSession() });
    const createRes = await createSiteSurveyRoute(
      new Request("http://localhost:3100/api/v1/commercial/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: oppId,
          siteName: `QP Tower MultiLvl ${rand}`,
          operationType: "SECURITY_GUARDING",
          conductedBy: creatorId,
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const srv = (await createRes.json()).survey;
    surveyMultiId = srv.id;
    if (srv.prospectiveSiteId) createdProspectiveSiteIds.push(srv.prospectiveSiteId);

    const subRes = await surveyWorkflowRoute(
      new Request(`http://localhost:3100/api/v1/commercial/surveys/${surveyMultiId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT" }),
      }),
      { params: { id: surveyMultiId } }
    );
    expect(subRes.status).toBe(200);
    const instanceId = (await subRes.json()).workflow.instanceId;

    // Level 1 approval -> Survey must stay IN_WORKFLOW
    (getServerSession as jest.Mock).mockResolvedValue({ user: approver1Session() });
    const l1Res = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${instanceId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "L1 approved" }),
      }),
      { params: { id: instanceId } }
    );
    expect(l1Res.status).toBe(200);

    const afterL1 = await prisma.preContractSurvey.findUnique({ where: { id: surveyMultiId } });
    expect(afterL1?.lifecycle).toBe("IN_WORKFLOW");

    // Level 2 approval -> Survey transitions to COMPLETED
    (getServerSession as jest.Mock).mockResolvedValue({ user: approver2Session() });
    const l2Res = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${instanceId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "L2 final approval" }),
      }),
      { params: { id: instanceId } }
    );
    expect(l2Res.status).toBe(200);

    const afterL2 = await prisma.preContractSurvey.findUnique({ where: { id: surveyMultiId } });
    expect(afterL2?.lifecycle).toBe("COMPLETED");
  });

  it("5. Addendum approval via Approval Center applies contract impact exactly once; module route is idempotent; duplicate Approval Center call rejected (409)", async () => {
    const wfInst = await prisma.workflowInstance.create({
      data: {
        templateId: addendumTemplateId,
        moduleType: "CONTRACT_ADDENDUM",
        referenceId: testAddendumId,
        status: "IN_PROGRESS",
        currentLevelNumber: 1,
        companyId: companyAId,
        operationScope: "SECURITY_GUARDING",
      },
    });

    (getServerSession as jest.Mock).mockResolvedValue({ user: approver1Session() });
    const appRes = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${wfInst.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "Addendum approved via Approval Center" }),
      }),
      { params: { id: wfInst.id } }
    );
    expect(appRes.status).toBe(200);

    const afterAddendum = await prisma.manpowerContractAddendum.findUnique({ where: { id: testAddendumId } });
    const afterContract = await prisma.manpowerContract.findUnique({ where: { id: testContractId } });
    expect(afterAddendum?.status).toBe("APPROVED");
    expect(afterContract?.totalContractValue).toBe(125000); // 100000 + 25000 applied once

    // Duplicate Approval Center call rejected (409) and contract impact untouched
    const dupRes = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${wfInst.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "Duplicate" }),
      }),
      { params: { id: wfInst.id } }
    );
    expect(dupRes.status).toBe(409);

    // Module-level route returns alreadyApproved: true without re-applying impact
    const modApproveRes = await approveAddendumRoute(
      new NextRequest(`http://localhost:3100/api/v1/commercial/contracts/${testContractId}/addendums/${testAddendumId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      }),
      { params: { contractId: testContractId, addendumId: testAddendumId } }
    );
    expect(modApproveRes.status).toBe(200);
    const modData = await modApproveRes.json();
    expect(modData.alreadyApproved).toBe(true);

    const finalContract = await prisma.manpowerContract.findUnique({ where: { id: testContractId } });
    expect(finalContract?.totalContractValue).toBe(125000);
  });

  it("6. Transaction rollback on injected adapter failure leaves WorkflowInstance IN_PROGRESS and history rolled back", async () => {
    const rollbackOpp = await prisma.preContractCase.create({
      data: {
        title: `OPP Rollback ${rand}`,
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        lifecycle: "IN_WORKFLOW",
        businessOutcome: "IN_PROGRESS",
        createdBy: creatorId,
      },
    });
    const wfInst = await prisma.workflowInstance.create({
      data: {
        templateId: oppTemplateId,
        moduleType: "PRE_CONTRACT_CASE",
        referenceId: rollbackOpp.id,
        status: "IN_PROGRESS",
        currentLevelNumber: 1,
        companyId: companyAId,
        operationScope: "SECURITY_GUARDING",
      },
    });

    const origAdapter = WorkflowAdapterRegistry.get("PRE_CONTRACT_CASE")!;
    const spy = jest.spyOn(origAdapter, "onWorkflowStatusChange").mockRejectedValueOnce(new Error("Injected adapter failure"));

    try {
      (getServerSession as jest.Mock).mockResolvedValue({ user: approver1Session() });
      const res = await executeApprovalActionRoute(
        new NextRequest(`http://localhost:3100/api/v1/approvals/${wfInst.id}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "APPROVE", remarks: "Should roll back" }),
        }),
        { params: { id: wfInst.id } }
      );
      expect(res.status).toBe(403);

      const persistedInst = await prisma.workflowInstance.findUnique({
        where: { id: wfInst.id },
        include: { history: true },
      });
      expect(persistedInst?.status).toBe("IN_PROGRESS");
      expect(persistedInst?.history.length).toBe(0);
    } finally {
      spy.mockRestore();
      await prisma.workflowInstance.deleteMany({ where: { id: wfInst.id } });
      await prisma.preContractCase.deleteMany({ where: { id: rollbackOpp.id } });
    }
  });
});
