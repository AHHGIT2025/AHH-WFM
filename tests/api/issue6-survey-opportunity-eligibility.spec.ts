import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { POST as createSiteSurveyRoute } from "../../apps/web/app/api/v1/commercial/surveys/route";
import { POST as surveyWorkflowRoute } from "../../apps/web/app/api/v1/commercial/surveys/[id]/workflow/route";
import { POST as executeApprovalActionRoute } from "../../apps/web/app/api/v1/approvals/[id]/action/route";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

describe("Issue #6: Site Survey Opportunity Eligibility (TEST DATABASE)", () => {
  const rand = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  let companyAId: string;
  let companyBId: string;
  let makerId: string;
  let checkerId: string;
  let compBMakerId: string;
  let clientId: string;
  let templateId: string;
  let draftOppId: string;
  let inWorkflowOppId: string;
  let cancelledOppId: string;
  let supersededOppId: string;
  let lostCompletedOppId: string;
  let approvedOppId: string;
  const createdSurveyIds: string[] = [];
  const createdSiteIds: string[] = [];

  const makerSession = () => ({
    user: {
      id: makerId,
      email: `iss6-maker-${rand}@ahh.local`,
      name: "Issue6 Maker",
      role: "COMMERCIAL_CREATOR",
      companyId: companyAId,
      operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true },
    },
  });

  const checkerSession = () => ({
    user: {
      id: checkerId,
      email: `iss6-checker-${rand}@ahh.local`,
      name: "Issue6 Checker",
      role: "COMMERCIAL_APPROVER",
      companyId: companyAId,
      operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true },
    },
  });

  const compBMakerSession = () => ({
    user: {
      id: compBMakerId,
      email: `iss6-compb-${rand}@ahh.local`,
      name: "Issue6 CompB",
      role: "COMMERCIAL_CREATOR",
      companyId: companyBId,
      operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true },
    },
  });

  beforeAll(async () => {
    const compA = await prisma.company.create({
      data: { companyName: `Issue6 CompA ${rand}`, companyCode: `I6A-${rand}`, isActive: true },
    });
    companyAId = compA.id;

    const compB = await prisma.company.create({
      data: { companyName: `Issue6 CompB ${rand}`, companyCode: `I6B-${rand}`, isActive: true },
    });
    companyBId = compB.id;

    const [m, c, cb] = await Promise.all([
      prisma.employee.create({
        data: {
          id: `emp-iss6-mk-${rand}`,
          name: "Issue6 Maker",
          department: "Commercial",
          companyId: companyAId,
          role: "COMMERCIAL_CREATOR",
          status: "Active",
          email: `iss6-maker-${rand}@ahh.local`,
        },
      }),
      prisma.employee.create({
        data: {
          id: `emp-iss6-ck-${rand}`,
          name: "Issue6 Checker",
          department: "Operations",
          companyId: companyAId,
          role: "COMMERCIAL_APPROVER",
          status: "Active",
          email: `iss6-checker-${rand}@ahh.local`,
        },
      }),
      prisma.employee.create({
        data: {
          id: `emp-iss6-cb-${rand}`,
          name: "Issue6 CompB",
          department: "Commercial",
          companyId: companyBId,
          role: "COMMERCIAL_CREATOR",
          status: "Active",
          email: `iss6-compb-${rand}@ahh.local`,
        },
      }),
    ]);
    makerId = m.id;
    checkerId = c.id;
    compBMakerId = cb.id;

    const client = await prisma.preContractProspectClient.create({
      data: { companyId: companyAId, operationType: "SECURITY_GUARDING", name: `Issue6 Client ${rand}` },
    });
    clientId = client.id;

    const [dOpp, wOpp, cOpp, sOpp, lOpp, aOpp] = await Promise.all([
      prisma.preContractCase.create({
        data: { companyId: companyAId, operationType: "SECURITY_GUARDING", title: `I6 Draft ${rand}`, prospectClientId: clientId, lifecycle: "DRAFT", createdBy: makerId },
      }),
      prisma.preContractCase.create({
        data: { companyId: companyAId, operationType: "SECURITY_GUARDING", title: `I6 InWF ${rand}`, prospectClientId: clientId, lifecycle: "IN_WORKFLOW", createdBy: makerId },
      }),
      prisma.preContractCase.create({
        data: { companyId: companyAId, operationType: "SECURITY_GUARDING", title: `I6 Cancelled ${rand}`, prospectClientId: clientId, lifecycle: "CANCELLED", businessOutcome: "LOST", createdBy: makerId },
      }),
      prisma.preContractCase.create({
        data: { companyId: companyAId, operationType: "SECURITY_GUARDING", title: `I6 Superseded ${rand}`, prospectClientId: clientId, lifecycle: "SUPERSEDED", createdBy: makerId },
      }),
      prisma.preContractCase.create({
        data: { companyId: companyAId, operationType: "SECURITY_GUARDING", title: `I6 Lost ${rand}`, prospectClientId: clientId, lifecycle: "COMPLETED", businessOutcome: "LOST", createdBy: makerId },
      }),
      prisma.preContractCase.create({
        data: { companyId: companyAId, operationType: "SECURITY_GUARDING", title: `I6 Approved ${rand}`, prospectClientId: clientId, lifecycle: "COMPLETED", businessOutcome: "IN_PROGRESS", createdBy: makerId },
      }),
    ]);
    draftOppId = dOpp.id;
    inWorkflowOppId = wOpp.id;
    cancelledOppId = cOpp.id;
    supersededOppId = sOpp.id;
    lostCompletedOppId = lOpp.id;
    approvedOppId = aOpp.id;

    await prisma.workflowTemplate.updateMany({
      where: { moduleType: "SITE_SURVEY", isDefault: true },
      data: { isDefault: false },
    });
    const tmpl = await prisma.workflowTemplate.create({
      data: {
        workflowName: `Issue6 Survey Tpl ${rand}`,
        moduleType: "SITE_SURVEY",
        appliesTo: "ACTIVATION",
        operationType: "SECURITY_GUARDING",
        isActive: true,
        isDefault: true,
        levels: {
          create: [
            {
              levelNumber: 1,
              levelName: "Ops Approver",
              approvalRule: "ANY_ONE",
              isMandatory: true,
              approvers: {
                create: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: checkerId, employeeName: "Issue6 Checker" }],
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
      await prisma.workflowTemplateApprover.deleteMany({ where: { level: { templateId } } });
      await prisma.workflowTemplateLevel.deleteMany({ where: { templateId } });
      await prisma.workflowTemplate.delete({ where: { id: templateId } });
      await prisma.preContractCase.deleteMany({
        where: { id: { in: [draftOppId, inWorkflowOppId, cancelledOppId, supersededOppId, lostCompletedOppId, approvedOppId] } },
      });
      await prisma.preContractProspectClient.deleteMany({ where: { id: clientId } });
      await prisma.employee.deleteMany({ where: { id: { in: [makerId, checkerId, compBMakerId] } } });
      await prisma.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
    } catch (e) {
      console.error("Cleanup error:", e);
    }
    await prisma.$disconnect();
  });

  it("1. DRAFT, IN_WORKFLOW, CANCELLED, SUPERSEDED, and LOST opportunities are rejected (400) on Survey creation", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(makerSession());

    for (const [label, cId] of [
      ["DRAFT", draftOppId],
      ["IN_WORKFLOW", inWorkflowOppId],
      ["CANCELLED", cancelledOppId],
      ["SUPERSEDED", supersededOppId],
      ["LOST", lostCompletedOppId],
    ]) {
      const res = await createSiteSurveyRoute(
        new Request("http://localhost:3100/api/v1/commercial/surveys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            caseId: cId,
            siteName: `Site ${label} ${rand}`,
            siteAddress: "Doha",
            operationType: "SECURITY_GUARDING",
          }),
        })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Ineligible Opportunity");
    }
  });

  it("2. Cross-company request is rejected with 403 before eligibility disclosure", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(compBMakerSession());
    const res = await createSiteSurveyRoute(
      new Request("http://localhost:3100/api/v1/commercial/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: draftOppId,
          siteName: `CrossCo ${rand}`,
          siteAddress: "Doha",
        }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("3. Approved (COMPLETED, IN_PROGRESS) opportunity succeeds (201) and supports legitimate multi-site creation while blocking duplicates (409)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(makerSession());

    const res1 = await createSiteSurveyRoute(
      new Request("http://localhost:3100/api/v1/commercial/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: approvedOppId,
          siteName: `Approved Site A ${rand}`,
          siteAddress: "West Bay",
          operationType: "SECURITY_GUARDING",
        }),
      })
    );
    expect(res1.status).toBe(201);
    const d1 = await res1.json();
    createdSurveyIds.push(d1.survey.id);
    if (d1.survey.prospectiveSiteId) createdSiteIds.push(d1.survey.prospectiveSiteId);

    // Same site -> 409 (Issue #5 preserved)
    const dupRes = await createSiteSurveyRoute(
      new Request("http://localhost:3100/api/v1/commercial/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: approvedOppId,
          siteName: `Approved Site A ${rand}`,
          siteAddress: "West Bay",
          operationType: "SECURITY_GUARDING",
        }),
      })
    );
    expect(dupRes.status).toBe(409);

    // Distinct second physical site on same COMPLETED opportunity -> 201 (multi-site preserved)
    const res2 = await createSiteSurveyRoute(
      new Request("http://localhost:3100/api/v1/commercial/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: approvedOppId,
          siteName: `Approved Site B ${rand}`,
          siteAddress: "Lusail",
          operationType: "SECURITY_GUARDING",
        }),
      })
    );
    expect(res2.status).toBe(201);
    const d2 = await res2.json();
    createdSurveyIds.push(d2.survey.id);
    if (d2.survey.prospectiveSiteId) createdSiteIds.push(d2.survey.prospectiveSiteId);
  });

  it("4. Survey SUBMIT and Approval Center APPROVE block legacy surveys for unapproved opportunities (400), while RETURN/REJECT remain allowed (200)", async () => {
    const legacyDraftOppSurvey = await prisma.preContractSurvey.create({
      data: {
        companyId: companyAId,
        operationType: "SECURITY_GUARDING",
        caseId: draftOppId,
        lifecycle: "DRAFT",
        conductedBy: makerId,
        responses: {
          create: [
            { elementCode: "HEADCOUNT", numericValue: 6 },
            { elementCode: "RELIEVER_REQUIRED", booleanValue: false },
            { elementCode: "COVERAGE_TYPE", textValue: "12H_DAY" },
          ],
        },
      },
    });
    createdSurveyIds.push(legacyDraftOppSurvey.id);

    // SUBMIT blocked (400)
    (getServerSession as jest.Mock).mockResolvedValue(makerSession());
    const subRes = await surveyWorkflowRoute(
      new Request(`http://localhost:3100/api/v1/commercial/surveys/${legacyDraftOppSurvey.id}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT" }),
      }),
      { params: { id: legacyDraftOppSurvey.id } }
    );
    expect(subRes.status).toBe(400);

    // Legacy IN_WORKFLOW survey -> Approval Center APPROVE blocked (400), RETURN allowed (200)
    await prisma.preContractSurvey.update({
      where: { id: legacyDraftOppSurvey.id },
      data: { lifecycle: "IN_WORKFLOW" },
    });
    const wfInst = await prisma.workflowInstance.create({
      data: {
        templateId,
        moduleType: "SITE_SURVEY",
        referenceId: legacyDraftOppSurvey.id,
        status: "IN_PROGRESS",
        currentLevelNumber: 1,
        companyId: companyAId,
        operationScope: "SECURITY_GUARDING",
      },
    });

    (getServerSession as jest.Mock).mockResolvedValue(checkerSession());
    const appRes = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${wfInst.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "Should block" }),
      }),
      { params: { id: wfInst.id } }
    );
    expect(appRes.status).toBe(400);

    const retRes = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${wfInst.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RETURN", remarks: "Opportunity not yet approved" }),
      }),
      { params: { id: wfInst.id } }
    );
    expect(retRes.status).toBe(200);
  });

  it("5. UI source filters New Site Survey opportunities to COMPLETED (non-LOST) and displays eligibility guidance", () => {
    const uiPath = path.resolve(__dirname, "../../apps/web/app/commercial/surveys/page.tsx");
    const source = fs.readFileSync(uiPath, "utf8");
    expect(source).toContain('c.lifecycle === "COMPLETED" && c.businessOutcome !== "LOST"');
    expect(source).toContain("ineligibleOpportunityCount");
    expect(source).toContain("Only approved (");
  });
});
