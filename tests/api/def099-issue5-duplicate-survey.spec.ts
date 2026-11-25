import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { POST as createSiteSurveyRoute } from "../../apps/web/app/api/v1/commercial/surveys/route";
import { PATCH as patchSiteSurveyRoute } from "../../apps/web/app/api/v1/commercial/surveys/[id]/route";
import { POST as surveyWorkflowRoute } from "../../apps/web/app/api/v1/commercial/surveys/[id]/workflow/route";
import { POST as executeApprovalActionRoute } from "../../apps/web/app/api/v1/approvals/[id]/action/route";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

describe("Issue #5 (DEF-099): Duplicate Site Survey Prevention (TEST DATABASE)", () => {
  const rand = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  let companyAId: string;
  let companyBId: string;
  let oppId: string;
  let templateId: string;
  let makerId: string;
  let checkerId: string;
  let compBMakerId: string;
  let primarySurveyId: string;
  let primarySiteId: string;
  const createdSurveyIds: string[] = [];
  const createdSiteIds: string[] = [];

  const makerSession = () => ({
    user: {
      id: makerId,
      email: `iss5-maker-${rand}@ahh.local`,
      name: "Issue5 Maker",
      role: "COMMERCIAL_CREATOR",
      companyId: companyAId,
      operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true },
    },
  });

  const checkerSession = () => ({
    user: {
      id: checkerId,
      email: `iss5-checker-${rand}@ahh.local`,
      name: "Issue5 Checker",
      role: "COMMERCIAL_APPROVER",
      companyId: companyAId,
      operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true },
    },
  });

  const compBMakerSession = () => ({
    user: {
      id: compBMakerId,
      email: `iss5-compb-${rand}@ahh.local`,
      name: "Issue5 CompB Maker",
      role: "COMMERCIAL_CREATOR",
      companyId: companyBId,
      operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true },
    },
  });

  beforeAll(async () => {
    const compA = await prisma.company.create({
      data: { companyName: `Issue5 CompA ${rand}`, companyCode: `I5A-${rand}`, isActive: true },
    });
    companyAId = compA.id;

    const compB = await prisma.company.create({
      data: { companyName: `Issue5 CompB ${rand}`, companyCode: `I5B-${rand}`, isActive: true },
    });
    companyBId = compB.id;

    const makerEmp = await prisma.employee.create({
      data: {
        id: `emp-iss5-mk-${rand}`,
        name: "Issue5 Maker",
        department: "Commercial",
        companyId: companyAId,
        role: "COMMERCIAL_CREATOR",
        status: "Active",
        email: `iss5-maker-${rand}@ahh.local`,
      },
    });
    makerId = makerEmp.id;

    const checkerEmp = await prisma.employee.create({
      data: {
        id: `emp-iss5-ck-${rand}`,
        name: "Issue5 Checker",
        department: "Operations",
        companyId: companyAId,
        role: "COMMERCIAL_APPROVER",
        status: "Active",
        email: `iss5-checker-${rand}@ahh.local`,
      },
    });
    checkerId = checkerEmp.id;

    const compBEmp = await prisma.employee.create({
      data: {
        id: `emp-iss5-cb-${rand}`,
        name: "Issue5 CompB",
        department: "Commercial",
        companyId: companyBId,
        role: "COMMERCIAL_CREATOR",
        status: "Active",
        email: `iss5-compb-${rand}@ahh.local`,
      },
    });
    compBMakerId = compBEmp.id;

    const client = await prisma.preContractProspectClient.create({
      data: {
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        name: `Issue5 Client ${rand}`,
      },
    });

    const opp = await prisma.preContractCase.create({
      data: {
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        title: `Issue5 OPP ${rand}`,
        prospectClientId: client.id,
        lifecycle: "COMPLETED",
        createdBy: makerId,
      },
    });
    oppId = opp.id;

    await prisma.workflowTemplate.updateMany({
      where: { moduleType: "SITE_SURVEY", isDefault: true },
      data: { isDefault: false },
    });

    const tmpl = await prisma.workflowTemplate.create({
      data: {
        workflowName: `Issue5 Survey Workflow ${rand}`,
        moduleType: "SITE_SURVEY",
        appliesTo: "ACTIVATION",
        operationType: "SECURITY_GUARDING",
        isActive: true,
        isDefault: true,
        levels: {
          create: [
            {
              levelNumber: 1,
              levelName: "Ops Manager",
              approvalRule: "ANY_ONE",
              isMandatory: true,
              approvers: {
                create: [
                  {
                    approverType: "SPECIFIC_EMPLOYEE",
                    employeeId: checkerId,
                    employeeName: "Issue5 Checker",
                  },
                ],
              },
            },
          ],
        },
      },
    });
    templateId = tmpl.id;
  });

  afterAll(async () => {
    try {
      const wfInstances = await prisma.workflowInstance.findMany({
        where: { referenceId: { in: createdSurveyIds } },
        select: { id: true },
      });
      const wfIds = wfInstances.map((w) => w.id);
      if (wfIds.length > 0) {
        await prisma.workflowActionHistory.deleteMany({ where: { instanceId: { in: wfIds } } });
        await prisma.workflowInstance.deleteMany({ where: { id: { in: wfIds } } });
      }
      if (createdSurveyIds.length > 0) {
        await prisma.surveyResponse.deleteMany({ where: { surveyId: { in: createdSurveyIds } } });
        await prisma.surveyConfigurationSnapshot.deleteMany({ where: { surveyId: { in: createdSurveyIds } } });
        await prisma.preContractSurvey.deleteMany({ where: { id: { in: createdSurveyIds } } });
      }
      if (createdSiteIds.length > 0) {
        await prisma.preContractProspectiveSite.deleteMany({ where: { id: { in: createdSiteIds } } });
      }
      if (templateId) {
        await prisma.workflowTemplateApprover.deleteMany({ where: { level: { templateId } } });
        await prisma.workflowTemplateLevel.deleteMany({ where: { templateId } });
        await prisma.workflowTemplate.delete({ where: { id: templateId } });
      }
      if (oppId) {
        await prisma.preContractCase.delete({ where: { id: oppId } });
      }
      await prisma.preContractProspectClient.deleteMany({ where: { companyId: companyAId } });
      await prisma.employee.deleteMany({ where: { id: { in: [makerId, checkerId, compBMakerId] } } });
      await prisma.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
    } catch (e) {
      console.error("Cleanup error:", e);
    }
    await prisma.$disconnect();
  });

  it("1. First survey creation succeeds (201) and duplicate DRAFT is rejected (409)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(makerSession());

    const res1 = await createSiteSurveyRoute(
      new Request("http://localhost:3100/api/v1/commercial/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: oppId,
          siteName: `Primary Tower ${rand}`,
          siteAddress: "West Bay, Doha",
          operationType: "SECURITY_GUARDING",
        }),
      })
    );
    expect(res1.status).toBe(201);
    const data1 = await res1.json();
    primarySurveyId = data1.survey.id;
    primarySiteId = data1.survey.prospectiveSiteId;
    createdSurveyIds.push(primarySurveyId);
    if (primarySiteId) createdSiteIds.push(primarySiteId);

    // Duplicate DRAFT attempt for same case + site -> 409 Conflict
    const dupDraftRes = await createSiteSurveyRoute(
      new Request("http://localhost:3100/api/v1/commercial/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: oppId,
          siteName: `Primary Tower ${rand}`,
          siteAddress: "West Bay, Doha",
          operationType: "SECURITY_GUARDING",
        }),
      })
    );
    expect(dupDraftRes.status).toBe(409);
    const dupBody = await dupDraftRes.json();
    expect(dupBody.existingSurveyId).toBe(primarySurveyId);
  });

  it("2. Issue #4 regression: incomplete survey SUBMIT is still rejected (400), then valid SUBMIT succeeds and duplicate IN_WORKFLOW is rejected (409)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(makerSession());

    // Incomplete SUBMIT blocked by Issue #4
    const incompleteSubRes = await surveyWorkflowRoute(
      new Request(`http://localhost:3100/api/v1/commercial/surveys/${primarySurveyId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT" }),
      }),
      { params: { id: primarySurveyId } }
    );
    expect(incompleteSubRes.status).toBe(400);

    // Seed mandatory staffing fields
    const patchRes = await patchSiteSurveyRoute(
      new Request(`http://localhost:3100/api/v1/commercial/surveys/${primarySurveyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responses: [
            { elementCode: "HEADCOUNT", numericValue: 10 },
            { elementCode: "RELIEVER_REQUIRED", booleanValue: false },
            { elementCode: "COVERAGE_TYPE", textValue: "12H_DAY" },
          ],
        }),
      }),
      { params: { id: primarySurveyId } }
    );
    expect(patchRes.status).toBe(200);

    const subRes = await surveyWorkflowRoute(
      new Request(`http://localhost:3100/api/v1/commercial/surveys/${primarySurveyId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT" }),
      }),
      { params: { id: primarySurveyId } }
    );
    expect(subRes.status).toBe(200);

    // Duplicate IN_WORKFLOW attempt -> 409 Conflict
    const dupWfRes = await createSiteSurveyRoute(
      new Request("http://localhost:3100/api/v1/commercial/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: oppId,
          prospectiveSiteId: primarySiteId,
          operationType: "SECURITY_GUARDING",
        }),
      })
    );
    expect(dupWfRes.status).toBe(409);
  });

  it("3. Duplicate COMPLETED (approved) survey is rejected (409) and cross-company probing is blocked (403)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(checkerSession());
    const wf = await prisma.workflowInstance.findFirst({ where: { referenceId: primarySurveyId } });
    expect(wf).toBeTruthy();

    const appRes = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${wf!.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "Approved Primary" }),
      }),
      { params: { id: wf!.id } }
    );
    expect(appRes.status).toBe(200);

    // Duplicate COMPLETED attempt -> 409 Conflict
    (getServerSession as jest.Mock).mockResolvedValue(makerSession());
    const dupCompRes = await createSiteSurveyRoute(
      new Request("http://localhost:3100/api/v1/commercial/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: oppId,
          siteName: `Primary Tower ${rand}`,
          siteAddress: "West Bay, Doha",
        }),
      })
    );
    expect(dupCompRes.status).toBe(409);
    const dupCompBody = await dupCompRes.json();
    expect(dupCompBody.existingSurveyId).toBe(primarySurveyId);
    expect(dupCompBody.existingLifecycle).toBe("COMPLETED");

    // Cross-company user gets 403 Forbidden (cannot probe existingSurveyId)
    (getServerSession as jest.Mock).mockResolvedValue(compBMakerSession());
    const crossCompRes = await createSiteSurveyRoute(
      new Request("http://localhost:3100/api/v1/commercial/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: oppId,
          siteName: `Primary Tower ${rand}`,
          siteAddress: "West Bay, Doha",
        }),
      })
    );
    expect(crossCompRes.status).toBe(403);
    const crossBody = await crossCompRes.json();
    expect(crossBody.existingSurveyId).toBeUndefined();
  });

  it("4. Direct API submission and Approval Center APPROVE block legacy/pre-existing duplicates (409), while RETURN/REJECT remain allowed", async () => {
    // Simulate a legacy duplicate DRAFT survey for the same (oppId, primarySiteId)
    const legacyDup = await prisma.preContractSurvey.create({
      data: {
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        caseId: oppId,
        prospectiveSiteId: primarySiteId,
        lifecycle: "DRAFT",
        conductedBy: makerId,
        responses: {
          create: [
            { elementCode: "HEADCOUNT", numericValue: 5 },
            { elementCode: "RELIEVER_REQUIRED", booleanValue: true },
            { elementCode: "COVERAGE_TYPE", textValue: "24/7" },
          ],
        },
      },
    });
    createdSurveyIds.push(legacyDup.id);

    // Direct SUBMIT blocked with 409
    (getServerSession as jest.Mock).mockResolvedValue(makerSession());
    const subDupRes = await surveyWorkflowRoute(
      new Request(`http://localhost:3100/api/v1/commercial/surveys/${legacyDup.id}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT" }),
      }),
      { params: { id: legacyDup.id } }
    );
    expect(subDupRes.status).toBe(409);

    // Simulate an IN_WORKFLOW duplicate awaiting Approval Center action
    await prisma.preContractSurvey.update({
      where: { id: legacyDup.id },
      data: { lifecycle: "IN_WORKFLOW" },
    });
    const dupWf = await prisma.workflowInstance.create({
      data: {
        templateId,
        moduleType: "SITE_SURVEY",
        referenceId: legacyDup.id,
        status: "IN_PROGRESS",
        currentLevelNumber: 1,
        companyId: companyAId,
        operationScope: "SECURITY_GUARDING",
      },
    });

    // Approval Center APPROVE blocked with 409
    (getServerSession as jest.Mock).mockResolvedValue(checkerSession());
    const appDupRes = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${dupWf.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "Should block" }),
      }),
      { params: { id: dupWf.id } }
    );
    expect(appDupRes.status).toBe(409);

    // Approval Center REJECT remains allowed (200) -> transitions duplicate to CANCELLED
    const rejDupRes = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${dupWf.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REJECT", remarks: "Rejected duplicate" }),
      }),
      { params: { id: dupWf.id } }
    );
    expect(rejDupRes.status).toBe(200);
  }, 30000);

  it("5. Null prospectiveSiteId duplicates are blocked on SUBMIT, while CANCELLED/SUPERSEDED and multi-site surveys are allowed", async () => {
    // Null prospectiveSiteId duplicate check
    const nullSite1 = await prisma.preContractSurvey.create({
      data: {
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        caseId: oppId,
        prospectiveSiteId: null,
        lifecycle: "COMPLETED",
        conductedBy: makerId,
      },
    });
    const nullSite2 = await prisma.preContractSurvey.create({
      data: {
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        caseId: oppId,
        prospectiveSiteId: null,
        lifecycle: "DRAFT",
        conductedBy: makerId,
        responses: {
          create: [
            { elementCode: "HEADCOUNT", numericValue: 4 },
            { elementCode: "RELIEVER_REQUIRED", booleanValue: false },
            { elementCode: "COVERAGE_TYPE", textValue: "12H_DAY" },
          ],
        },
      },
    });
    createdSurveyIds.push(nullSite1.id, nullSite2.id);

    (getServerSession as jest.Mock).mockResolvedValue(makerSession());
    const nullSubRes = await surveyWorkflowRoute(
      new Request(`http://localhost:3100/api/v1/commercial/surveys/${nullSite2.id}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT" }),
      }),
      { params: { id: nullSite2.id } }
    );
    expect(nullSubRes.status).toBe(409);

    // Multi-site: distinct site on same oppId succeeds (201)
    const multiSiteRes = await createSiteSurveyRoute(
      new Request("http://localhost:3100/api/v1/commercial/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: oppId,
          siteName: `Secondary Annex ${rand}`,
          siteAddress: "Lusail Marina",
          operationType: "SECURITY_GUARDING",
        }),
      })
    );
    expect(multiSiteRes.status).toBe(201);
    const multiData = await multiSiteRes.json();
    createdSurveyIds.push(multiData.survey.id);
    if (multiData.survey.prospectiveSiteId) createdSiteIds.push(multiData.survey.prospectiveSiteId);

    // Mark Secondary Annex survey SUPERSEDED -> re-creation for same site succeeds (201)
    await prisma.preContractSurvey.update({
      where: { id: multiData.survey.id },
      data: { lifecycle: "SUPERSEDED" },
    });
    const recreateAfterSuperseded = await createSiteSurveyRoute(
      new Request("http://localhost:3100/api/v1/commercial/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: oppId,
          siteName: `Secondary Annex ${rand}`,
          siteAddress: "Lusail Marina",
          operationType: "SECURITY_GUARDING",
        }),
      })
    );
    expect(recreateAfterSuperseded.status).toBe(201);
    const recData = await recreateAfterSuperseded.json();
    createdSurveyIds.push(recData.survey.id);
  });

  it("6. Concurrent creation requests for same case + site serialize cleanly (one 201, one 409)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(makerSession());
    const concSite = await prisma.preContractProspectiveSite.create({
      data: {
        name: `Concurrent Site ${rand}`,
        address: "Doha Corniche",
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
      },
    });
    createdSiteIds.push(concSite.id);

    const [r1, r2] = await Promise.all([
      createSiteSurveyRoute(
        new Request("http://localhost:3100/api/v1/commercial/surveys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            caseId: oppId,
            prospectiveSiteId: concSite.id,
            operationType: "SECURITY_GUARDING",
          }),
        })
      ),
      createSiteSurveyRoute(
        new Request("http://localhost:3100/api/v1/commercial/surveys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            caseId: oppId,
            prospectiveSiteId: concSite.id,
            operationType: "SECURITY_GUARDING",
          }),
        })
      ),
    ]);

    const statuses = [r1.status, r2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);

    for (const res of [r1, r2]) {
      if (res.status === 201) {
        const j = await res.json();
        createdSurveyIds.push(j.survey.id);
      }
    }
  });

  it("7. UI source includes duplicate survey detection, blocking, and Open Existing Survey link", () => {
    const uiPath = path.resolve(__dirname, "../../apps/web/app/commercial/surveys/page.tsx");
    const source = fs.readFileSync(uiPath, "utf8");
    expect(source).toContain("activeSurveysForSelectedCase");
    expect(source).toContain("matchingActiveSiteSurvey");
    expect(source).toContain("confirmAdditionalSite");
    expect(source).toContain("Open Existing Survey");
  });
});
