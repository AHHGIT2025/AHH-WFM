import fs from "fs";
import path from "path";
import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { resolveCommercialWorkflowTemplate } from "../../apps/web/lib/commercial-workflow-template";
import { POST as costingWorkflowRoute } from "../../apps/web/app/api/v1/commercial/costing/[id]/workflow/route";
import { POST as surveyWorkflowRoute } from "../../apps/web/app/api/v1/commercial/surveys/[id]/workflow/route";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

describe("Issue #7 (DEF-096): Commercial Workflow Template Mapping & Isolation (TEST DATABASE)", () => {
  const rand = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  let companyId: string;
  let makerId: string;
  let checkerId: string;
  let clientId: string;
  let oppId: string;
  let surveyId: string;
  let estimateId: string;
  const createdTemplateIds: string[] = [];

  const makerSession = () => ({
    user: {
      id: makerId,
      email: `iss7-maker-${rand}@ahh.local`,
      name: "Issue7 Maker",
      role: "COMMERCIAL_CREATOR",
      companyId,
      operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: true },
    },
  });

  const makeTemplate = async (
    workflowName: string,
    moduleType: string,
    opts: { isActive?: boolean; isDefault?: boolean; withLevels?: boolean } = {}
  ) => {
    const t = await prisma.workflowTemplate.create({
      data: {
        workflowName,
        moduleType,
        appliesTo: "ACTIVATION",
        operationType: "SECURITY_GUARDING",
        isActive: opts.isActive ?? true,
        isDefault: opts.isDefault ?? false,
        ...(opts.withLevels === false
          ? {}
          : {
              levels: {
                create: [
                  {
                    levelNumber: 1,
                    levelName: "Level 1",
                    approvalRule: "ANY_ONE",
                    isMandatory: true,
                    approvers: {
                      create: [
                        {
                          approverType: "SPECIFIC_EMPLOYEE",
                          employeeId: checkerId,
                          employeeName: "Issue7 Checker",
                        },
                      ],
                    },
                  },
                ],
              },
            }),
      },
    });
    createdTemplateIds.push(t.id);
    return t;
  };

  beforeAll(async () => {
    const comp = await prisma.company.create({
      data: { companyName: `Issue7 Co ${rand}`, companyCode: `I7-${rand}`, isActive: true },
    });
    companyId = comp.id;

    const [m, c] = await Promise.all([
      prisma.employee.create({
        data: {
          id: `emp-iss7-mk-${rand}`,
          name: "Issue7 Maker",
          department: "Commercial",
          companyId,
          role: "COMMERCIAL_CREATOR",
          status: "Active",
          email: `iss7-maker-${rand}@ahh.local`,
        },
      }),
      prisma.employee.create({
        data: {
          id: `emp-iss7-ck-${rand}`,
          name: "Issue7 Checker",
          department: "Operations",
          companyId,
          role: "COMMERCIAL_APPROVER",
          status: "Active",
          email: `iss7-checker-${rand}@ahh.local`,
        },
      }),
    ]);
    makerId = m.id;
    checkerId = c.id;

    const client = await prisma.preContractProspectClient.create({
      data: { companyId, operationType: "SECURITY_GUARDING", name: `Issue7 Client ${rand}` },
    });
    clientId = client.id;

    const opp = await prisma.preContractCase.create({
      data: {
        companyId,
        operationType: "SECURITY_GUARDING",
        title: `Issue7 Opp ${rand}`,
        prospectClientId: clientId,
        lifecycle: "COMPLETED",
        businessOutcome: "IN_PROGRESS",
        createdBy: makerId,
      },
    });
    oppId = opp.id;

    const survey = await prisma.preContractSurvey.create({
      data: {
        companyId,
        operationType: "SECURITY_GUARDING",
        caseId: oppId,
        lifecycle: "COMPLETED",
        conductedBy: makerId,
        responses: {
          create: [
            { elementCode: "HEADCOUNT", numericValue: 10 },
            { elementCode: "RELIEVER_REQUIRED", booleanValue: false },
            { elementCode: "COVERAGE_TYPE", textValue: "12H_DAY" },
          ],
        },
      },
    });
    surveyId = survey.id;

    const est = await prisma.preContractCostEstimate.create({
      data: {
        companyId,
        operationType: "SECURITY_GUARDING",
        caseId: oppId,
        surveyId,
        status: "DRAFT",
        createdBy: makerId,
        versions: {
          create: [
            {
              versionNumber: 1,
              status: "DRAFT",
              pricingBasis: "MARKUP",
              totalDirectCost: 20000,
              totalIndirectCost: 0,
              totalCost: 20000,
              targetMarkupPercentage: 20,
              sellingPrice: 24000,
              createdBy: makerId,
            },
          ],
        },
      },
    });
    estimateId = est.id;
  });

  afterAll(async () => {
    try {
      const wfInstances = await prisma.workflowInstance.findMany({
        where: { referenceId: { in: [oppId, surveyId, estimateId] } },
        select: { id: true },
      });
      const wfIds = wfInstances.map((w) => w.id);
      if (wfIds.length > 0) {
        await prisma.workflowActionHistory.deleteMany({ where: { instanceId: { in: wfIds } } });
        await prisma.workflowInstance.deleteMany({ where: { id: { in: wfIds } } });
      }
      await prisma.preContractCostEstimateVersion.deleteMany({ where: { estimateId } });
      await prisma.preContractCostEstimate.deleteMany({ where: { id: estimateId } });
      await prisma.surveyResponse.deleteMany({ where: { surveyId } });
      await prisma.preContractSurvey.deleteMany({ where: { id: surveyId } });
      await prisma.preContractCase.deleteMany({ where: { id: oppId } });
      await prisma.preContractProspectClient.deleteMany({ where: { id: clientId } });
      if (createdTemplateIds.length > 0) {
        await prisma.workflowTemplateApprover.deleteMany({ where: { level: { templateId: { in: createdTemplateIds } } } });
        await prisma.workflowTemplateLevel.deleteMany({ where: { templateId: { in: createdTemplateIds } } });
        await prisma.workflowTemplate.deleteMany({ where: { id: { in: createdTemplateIds } } });
      }
      await prisma.employee.deleteMany({ where: { id: { in: [makerId, checkerId] } } });
      await prisma.company.deleteMany({ where: { id: companyId } });
    } catch (e) {
      console.error("Cleanup error:", e);
    }
    await prisma.$disconnect();
  });

  it("1. Cross-module isolation: template named SITE_SURVEY mapped to PRE_CONTRACT_CASE is NOT selected for SITE_SURVEY", async () => {
    // Deactivate any pre-existing SITE_SURVEY templates in TEST DB temporarily
    const prevSurveyTpls = await prisma.workflowTemplate.findMany({
      where: { moduleType: { in: ["SITE_SURVEY", "PRE_CONTRACT_SURVEY"] }, isActive: true },
      select: { id: true },
    });
    if (prevSurveyTpls.length > 0) {
      await prisma.workflowTemplate.updateMany({
        where: { id: { in: prevSurveyTpls.map((t) => t.id) } },
        data: { isActive: false },
      });
    }

    try {
      const misnamedCaseTpl = await makeTemplate("SITE_SURVEY", "PRE_CONTRACT_CASE", { isActive: true, isDefault: true });

      const surveyRes = await resolveCommercialWorkflowTemplate(prisma, "SITE_SURVEY");
      expect(surveyRes.ok).toBe(false);
      if (!surveyRes.ok) {
        expect(surveyRes.error).toContain("Missing Workflow Configuration");
      }

      // Meanwhile OPPORTUNITY resolves its own PRE_CONTRACT_CASE template
      const oppRes = await resolveCommercialWorkflowTemplate(prisma, "OPPORTUNITY");
      expect(oppRes.ok).toBe(true);
      if (oppRes.ok) {
        expect(oppRes.template.id).toBe(misnamedCaseTpl.id);
      }

      // Now add actual SITE_SURVEY template -> SITE_SURVEY resolves it cleanly
      const realSurveyTpl = await makeTemplate("SITE_SURVEY_APPROVAL", "SITE_SURVEY", { isActive: true, isDefault: true });
      const surveyRes2 = await resolveCommercialWorkflowTemplate(prisma, "SITE_SURVEY");
      expect(surveyRes2.ok).toBe(true);
      if (surveyRes2.ok) {
        expect(surveyRes2.template.id).toBe(realSurveyTpl.id);
      }
    } finally {
      if (prevSurveyTpls.length > 0) {
        await prisma.workflowTemplate.updateMany({
          where: { id: { in: prevSurveyTpls.map((t) => t.id) } },
          data: { isActive: true },
        });
      }
    }
  });

  it("2. Inactive templates are ignored and ambiguous defaults fail closed", async () => {
    const prevPropTpls = await prisma.workflowTemplate.findMany({
      where: { moduleType: { in: ["PRE_CONTRACT_PROPOSAL", "COMMERCIAL_PROPOSAL"] }, isActive: true },
      select: { id: true },
    });
    if (prevPropTpls.length > 0) {
      await prisma.workflowTemplate.updateMany({
        where: { id: { in: prevPropTpls.map((t) => t.id) } },
        data: { isActive: false },
      });
    }

    try {
      await makeTemplate(`Inactive Proposal ${rand}`, "COMMERCIAL_PROPOSAL", { isActive: false, isDefault: true });
      const missingRes = await resolveCommercialWorkflowTemplate(prisma, "PROPOSAL");
      expect(missingRes.ok).toBe(false);

      const p1 = await makeTemplate(`Prop Default 1 ${rand}`, "COMMERCIAL_PROPOSAL", { isActive: true, isDefault: true });
      const p2 = await makeTemplate(`Prop Default 2 ${rand}`, "PRE_CONTRACT_PROPOSAL", { isActive: true, isDefault: true });

      const ambigRes = await resolveCommercialWorkflowTemplate(prisma, "PROPOSAL");
      expect(ambigRes.ok).toBe(false);
      if (!ambigRes.ok) {
        expect(ambigRes.error).toContain("Ambiguous Workflow Configuration");
      }

      // Unset default on p2 -> p1 is deterministically selected
      await prisma.workflowTemplate.update({ where: { id: p2.id }, data: { isDefault: false } });
      const okRes = await resolveCommercialWorkflowTemplate(prisma, "PROPOSAL");
      expect(okRes.ok).toBe(true);
      if (okRes.ok) {
        expect(okRes.template.id).toBe(p1.id);
      }
    } finally {
      if (prevPropTpls.length > 0) {
        await prisma.workflowTemplate.updateMany({
          where: { id: { in: prevPropTpls.map((t) => t.id) } },
          data: { isActive: true },
        });
      }
    }
  });

  it("3. Costing resolves Settings > Workflow Setup COSTING moduleType and Survey workflow submission records exact templateId", async () => {
    const prevCostTpls = await prisma.workflowTemplate.findMany({
      where: { moduleType: { in: ["PRE_CONTRACT_COSTING", "COMMERCIAL_COSTING", "COSTING"] }, isActive: true },
      select: { id: true },
    });
    if (prevCostTpls.length > 0) {
      await prisma.workflowTemplate.updateMany({
        where: { id: { in: prevCostTpls.map((t) => t.id) } },
        data: { isActive: false },
      });
    }

    const prevSurveyTpls = await prisma.workflowTemplate.findMany({
      where: { moduleType: { in: ["SITE_SURVEY", "PRE_CONTRACT_SURVEY"] }, isActive: true },
      select: { id: true },
    });
    if (prevSurveyTpls.length > 0) {
      await prisma.workflowTemplate.updateMany({
        where: { id: { in: prevSurveyTpls.map((t) => t.id) } },
        data: { isActive: false },
      });
    }

    try {
      const uiCostingTpl = await makeTemplate(`UI Costing ${rand}`, "COSTING", { isActive: true, isDefault: true });
      const costRes = await resolveCommercialWorkflowTemplate(prisma, "COSTING");
      expect(costRes.ok).toBe(true);
      if (costRes.ok) {
        expect(costRes.template.id).toBe(uiCostingTpl.id);
      }

      const siteSurveyTpl = await makeTemplate(`SITE_SURVEY_APPROVAL ${rand}`, "SITE_SURVEY", { isActive: true, isDefault: true });
      const testSite2 = await prisma.preContractProspectiveSite.create({
        data: { companyId, operationType: "SECURITY_GUARDING", name: `Issue7 Site2 ${rand}` },
      });
      const draftSrv = await prisma.preContractSurvey.create({
        data: {
          companyId,
          operationType: "SECURITY_GUARDING",
          caseId: oppId,
          prospectiveSiteId: testSite2.id,
          lifecycle: "DRAFT",
          conductedBy: makerId,
          responses: {
            create: [
              { elementCode: "HEADCOUNT", numericValue: 8 },
              { elementCode: "RELIEVER_REQUIRED", booleanValue: false },
              { elementCode: "COVERAGE_TYPE", textValue: "12H_DAY" },
            ],
          },
        },
      });

      try {
        (getServerSession as jest.Mock).mockResolvedValue(makerSession());
        const subRes = await surveyWorkflowRoute(
          new Request(`http://localhost:3100/api/v1/commercial/surveys/${draftSrv.id}/workflow`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "SUBMIT" }),
          }),
          { params: { id: draftSrv.id } }
        );
        expect(subRes.status).toBe(200);

        const wfInst = await prisma.workflowInstance.findFirst({ where: { referenceId: draftSrv.id } });
        expect(wfInst?.templateId).toBe(siteSurveyTpl.id);
      } finally {
        await prisma.workflowActionHistory.deleteMany({ where: { instance: { referenceId: draftSrv.id } } });
        await prisma.workflowInstance.deleteMany({ where: { referenceId: draftSrv.id } });
        await prisma.surveyResponse.deleteMany({ where: { surveyId: draftSrv.id } });
        await prisma.preContractSurvey.deleteMany({ where: { id: draftSrv.id } });
        await prisma.preContractProspectiveSite.deleteMany({ where: { id: testSite2.id } });
      }
    } finally {
      if (prevCostTpls.length > 0) {
        await prisma.workflowTemplate.updateMany({
          where: { id: { in: prevCostTpls.map((t) => t.id) } },
          data: { isActive: true },
        });
      }
      if (prevSurveyTpls.length > 0) {
        await prisma.workflowTemplate.updateMany({
          where: { id: { in: prevSurveyTpls.map((t) => t.id) } },
          data: { isActive: true },
        });
      }
    }
  });

  it("4. WorkflowManagementTab UI displays moduleType code and ambiguous configuration warning", () => {
    const uiPath = path.resolve(__dirname, "../../apps/web/app/settings/components/WorkflowManagementTab.tsx");
    const source = fs.readFileSync(uiPath, "utf8");
    expect(source).toContain("ambiguousModules");
    expect(source).toContain("Ambiguous Active Workflow Configuration Detected");
    expect(source).toContain("({tpl.moduleType})");
  });
});
