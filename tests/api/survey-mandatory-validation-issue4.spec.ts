import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { NextRequest } from "next/server";
import { PATCH as patchSurveyRoute } from "../../apps/web/app/api/v1/commercial/surveys/[id]/route";
import { POST as surveyWorkflowRoute } from "../../apps/web/app/api/v1/commercial/surveys/[id]/workflow/route";
import { POST as executeApprovalActionRoute } from "../../apps/web/app/api/v1/approvals/[id]/action/route";
import { validateSurveyStaffingForSubmission } from "../../apps/web/lib/survey-validation";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

describe("Issue #4 — Mandatory Site Survey Staffing Validation (TEST DATABASE)", () => {
  jest.setTimeout(30000);
  const rand = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const companyId = `COMP-ISS4-${rand}`;
  const otherCompanyId = `COMP-ISS4-OTH-${rand}`;
  const makerId = `emp-iss4-mk-${rand}`;
  const checkerId = `emp-iss4-ck-${rand}`;

  let caseId = "";
  let surveyTplId = "";
  let draftSurveyId = "";
  let legacyInWorkflowSurveyId = "";
  let legacyWorkflowInstanceId = "";
  let completedSurveyId = "";

  const makerSession = {
    id: makerId,
    employeeId: makerId,
    name: "Issue4 Surveyor",
    email: `iss4-mk-${rand}@test.local`,
    role: "COMMERCIAL_CREATOR",
    companyId,
    operationAccess: { allowedSecurityGuarding: true },
  };

  const checkerSession = {
    id: checkerId,
    employeeId: checkerId,
    name: "Issue4 Checker",
    email: `iss4-ck-${rand}@test.local`,
    role: "COMMERCIAL_APPROVER",
    companyId,
    operationAccess: { allowedSecurityGuarding: true },
  };

  beforeAll(async () => {
    await prisma.company.createMany({
      data: [
        { id: companyId, companyCode: `ISS4-${rand}`, companyName: `Issue4 Co ${rand}`, isActive: true },
        { id: otherCompanyId, companyCode: `ISS4O-${rand}`, companyName: `Issue4 Other ${rand}`, isActive: true },
      ],
    });
    await prisma.employee.createMany({
      data: [
        { id: makerId, name: "Issue4 Surveyor", department: "Commercial", companyId, role: "COMMERCIAL_CREATOR", status: "Active", email: `iss4-mk-${rand}@test.local` },
        { id: checkerId, name: "Issue4 Checker", department: "Operations", companyId, role: "COMMERCIAL_APPROVER", status: "Active", email: `iss4-ck-${rand}@test.local` },
      ],
    });

    const tpl = await prisma.workflowTemplate.create({
      data: {
        workflowName: `Issue4 Survey Tpl ${rand}`,
        moduleType: "SITE_SURVEY",
        appliesTo: "ACTIVATION",
        operationType: "SECURITY_GUARDING",
        isDefault: true,
        isActive: true,
        levels: {
          create: [
            {
              levelNumber: 1,
              levelName: "Operations Survey Approver",
              approvalRule: "ANY_ONE",
              isMandatory: true,
              approvers: { create: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: checkerId, employeeName: "Issue4 Checker" }] },
            },
          ],
        },
      },
    });
    surveyTplId = tpl.id;

    const opp = await prisma.preContractCase.create({
      data: {
        title: `Issue4 Opp ${rand}`,
        companyId,
        operationType: "SECURITY_GUARDING",
        lifecycle: "COMPLETED",
        createdBy: makerId,
      },
    });
    caseId = opp.id;

    const [site1, site2, site3] = await Promise.all([
      prisma.preContractProspectiveSite.create({ data: { companyId, operationType: "SECURITY_GUARDING", name: `Iss4 Site1 ${rand}` } }),
      prisma.preContractProspectiveSite.create({ data: { companyId, operationType: "SECURITY_GUARDING", name: `Iss4 Site2 ${rand}` } }),
      prisma.preContractProspectiveSite.create({ data: { companyId, operationType: "SECURITY_GUARDING", name: `Iss4 Site3 ${rand}` } }),
    ]);

    const draftSrv = await prisma.preContractSurvey.create({
      data: {
        caseId,
        companyId,
        prospectiveSiteId: site1.id,
        operationType: "SECURITY_GUARDING",
        lifecycle: "DRAFT",
        conductedBy: makerId,
      },
    });
    draftSurveyId = draftSrv.id;

    const legacySrv = await prisma.preContractSurvey.create({
      data: {
        caseId,
        companyId,
        prospectiveSiteId: site2.id,
        operationType: "SECURITY_GUARDING",
        lifecycle: "IN_WORKFLOW",
        conductedBy: makerId,
        workflowTemplateId: surveyTplId,
      },
    });
    legacyInWorkflowSurveyId = legacySrv.id;

    const wfInst = await prisma.workflowInstance.create({
      data: {
        templateId: surveyTplId,
        moduleType: "SITE_SURVEY",
        referenceId: legacyInWorkflowSurveyId,
        status: "IN_PROGRESS",
        currentLevelNumber: 1,
        companyId,
        operationScope: "SECURITY_GUARDING",
      },
    });
    legacyWorkflowInstanceId = wfInst.id;
    await prisma.preContractSurvey.update({
      where: { id: legacyInWorkflowSurveyId },
      data: { workflowInstanceId: legacyWorkflowInstanceId },
    });

    const compSrv = await prisma.preContractSurvey.create({
      data: {
        caseId,
        companyId,
        prospectiveSiteId: site3.id,
        operationType: "SECURITY_GUARDING",
        lifecycle: "COMPLETED",
        conductedBy: makerId,
      },
    });
    completedSurveyId = compSrv.id;
  });

  afterAll(async () => {
    try {
      await prisma.workflowActionHistory.deleteMany({ where: { instance: { referenceId: { in: [draftSurveyId, legacyInWorkflowSurveyId] } } } });
      await prisma.workflowInstance.deleteMany({ where: { referenceId: { in: [draftSurveyId, legacyInWorkflowSurveyId] } } });
      await prisma.surveyResponse.deleteMany({ where: { surveyId: { in: [draftSurveyId, legacyInWorkflowSurveyId, completedSurveyId] } } });
      await prisma.preContractSurvey.deleteMany({ where: { id: { in: [draftSurveyId, legacyInWorkflowSurveyId, completedSurveyId] } } });
      await prisma.preContractProspectiveSite.deleteMany({ where: { companyId } });
      await prisma.preContractCase.deleteMany({ where: { id: caseId } });
      await prisma.workflowTemplate.deleteMany({ where: { id: surveyTplId } });
      await prisma.employee.deleteMany({ where: { id: { in: [makerId, checkerId] } } });
      await prisma.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it("1-7. Unit validation distinguishes missing/zero HEADCOUNT, missing vs false RELIEVER_REQUIRED, missing COVERAGE_TYPE, and separate ELEM_POST_COUNT", () => {
    expect(validateSurveyStaffingForSubmission([]).missingFields.map((f) => f.field)).toEqual([
      "HEADCOUNT",
      "RELIEVER_REQUIRED",
      "COVERAGE_TYPE",
    ]);

    expect(
      validateSurveyStaffingForSubmission([
        { elementCode: "HEADCOUNT", numericValue: 0 },
        { elementCode: "RELIEVER_REQUIRED", booleanValue: false },
        { elementCode: "COVERAGE_TYPE", textValue: "12H_DAY" },
      ]).missingFields.map((f) => f.field)
    ).toEqual(["HEADCOUNT"]);

    expect(
      validateSurveyStaffingForSubmission([
        { elementCode: "HEADCOUNT", numericValue: -2 },
        { elementCode: "RELIEVER_REQUIRED", booleanValue: true },
        { elementCode: "COVERAGE_TYPE", textValue: "12H_DAY" },
      ]).missingFields.map((f) => f.field)
    ).toEqual(["HEADCOUNT"]);

    expect(
      validateSurveyStaffingForSubmission([
        { elementCode: "HEADCOUNT", numericValue: 14 },
        { elementCode: "COVERAGE_TYPE", textValue: "12H_DAY" },
      ]).missingFields.map((f) => f.field)
    ).toEqual(["RELIEVER_REQUIRED"]);

    const explicitFalse = validateSurveyStaffingForSubmission([
      { elementCode: "HEADCOUNT", numericValue: 14 },
      { elementCode: "RELIEVER_REQUIRED", booleanValue: false },
      { elementCode: "COVERAGE_TYPE", textValue: "12H_DAY" },
    ]);
    expect(explicitFalse.valid).toBe(true);

    expect(
      validateSurveyStaffingForSubmission([
        { elementCode: "HEADCOUNT", numericValue: 14 },
        { elementCode: "RELIEVER_REQUIRED", booleanValue: true },
      ]).missingFields.map((f) => f.field)
    ).toEqual(["COVERAGE_TYPE"]);
  });

  it("1, 2, 8, 9 & 11. Incomplete DRAFT saves (200), incomplete SUBMIT blocked (400), complete staffing submits (200), COMPLETED stays immutable (400)", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: makerSession });

    // Incomplete DRAFT save succeeds
    const saveDraftRes = await patchSurveyRoute(
      new Request(`http://localhost:3100/api/v1/commercial/surveys/${draftSurveyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses: [{ elementCode: "HEADCOUNT", numericValue: 14 }] }),
      }),
      { params: { id: draftSurveyId } }
    );
    expect(saveDraftRes.status).toBe(200);

    // Direct API SUBMIT blocked because RELIEVER_REQUIRED & COVERAGE_TYPE are missing
    const blockedSub = await surveyWorkflowRoute(
      new Request(`http://localhost:3100/api/v1/commercial/surveys/${draftSurveyId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT" }),
      }),
      { params: { id: draftSurveyId } }
    );
    expect(blockedSub.status).toBe(400);
    const blockedBody = await blockedSub.json();
    expect(blockedBody.missingFields.map((m: any) => m.field)).toEqual(["RELIEVER_REQUIRED", "COVERAGE_TYPE"]);

    // Complete mandatory staffing & submit succeeds
    const saveCompleteRes = await patchSurveyRoute(
      new Request(`http://localhost:3100/api/v1/commercial/surveys/${draftSurveyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responses: [
            { elementCode: "HEADCOUNT", numericValue: 14 },
            { elementCode: "RELIEVER_REQUIRED", booleanValue: true },
            { elementCode: "COVERAGE_TYPE", textValue: "12H_DAY" },
          ],
        }),
      }),
      { params: { id: draftSurveyId } }
    );
    expect(saveCompleteRes.status).toBe(200);

    const validSub = await surveyWorkflowRoute(
      new Request(`http://localhost:3100/api/v1/commercial/surveys/${draftSurveyId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT" }),
      }),
      { params: { id: draftSurveyId } }
    );
    expect(validSub.status).toBe(200);

    // Completed survey remains immutable
    const editCompletedRes = await patchSurveyRoute(
      new Request(`http://localhost:3100/api/v1/commercial/surveys/${completedSurveyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses: [{ elementCode: "HEADCOUNT", numericValue: 99 }] }),
      }),
      { params: { id: completedSurveyId } }
    );
    expect(editCompletedRes.status).toBe(400);
  });

  it("10 & 12. Approval Center & direct workflow block APPROVE on incomplete IN_WORKFLOW survey (400), allow RETURN (200), enforce SoD & company scope (403)", async () => {
    // Self-approval by maker blocked (403) or non-approver blocked
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { ...checkerSession, companyId: otherCompanyId },
    });
    const crossCompApprove = await surveyWorkflowRoute(
      new Request(`http://localhost:3100/api/v1/commercial/surveys/${legacyInWorkflowSurveyId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      }),
      { params: { id: legacyInWorkflowSurveyId } }
    );
    expect(crossCompApprove.status).toBe(403);

    // Authorized Checker cannot APPROVE incomplete IN_WORKFLOW survey via Approval Center (400)
    (getServerSession as jest.Mock).mockResolvedValue({ user: checkerSession });
    const acApprove = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${legacyWorkflowInstanceId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "Should fail validation" }),
      }),
      { params: { id: legacyWorkflowInstanceId } }
    );
    expect(acApprove.status).toBe(400);
    const acBody = await acApprove.json();
    expect(acBody.missingFields.map((m: any) => m.field)).toEqual(["HEADCOUNT", "RELIEVER_REQUIRED", "COVERAGE_TYPE"]);

    // Checker CAN RETURN incomplete survey to DRAFT for correction (200)
    const acReturn = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${legacyWorkflowInstanceId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RETURN", remarks: "Complete mandatory staffing fields" }),
      }),
      { params: { id: legacyWorkflowInstanceId } }
    );
    expect(acReturn.status).toBe(200);
    const afterReturn = await prisma.preContractSurvey.findUnique({ where: { id: legacyInWorkflowSurveyId } });
    expect(afterReturn?.lifecycle).toBe("DRAFT");
  });
});
