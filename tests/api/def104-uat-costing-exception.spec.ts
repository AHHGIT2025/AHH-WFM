import { prisma, Prisma } from "@ahh-wfm/database";
import { mockDb } from "@ahh-wfm/mock-data";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { POST as postCostingWorkflow } from "../../apps/web/app/api/v1/commercial/costing/[id]/workflow/route";
import { POST as postApprovalAction } from "../../apps/web/app/api/v1/approvals/[id]/action/route";
import { POST as postProposals } from "../../apps/web/app/api/v1/commercial/proposals/route";
import { POST as postProposalIssue } from "../../apps/web/app/api/v1/commercial/proposals/[id]/issue/route";
import { POST as postProposalConvert } from "../../apps/web/app/api/v1/commercial/proposals/[id]/convert/route";
import { UAT_UNVALIDATED_COSTING_BANNER } from "../../apps/web/lib/uat-costing-exception";

const Decimal = Prisma.Decimal;

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

describe("DEF-104 Scoped UAT Costing Fallback Exception", () => {
  const RUN_ID = `DEF104-${Date.now()}`;
  const COMP_SG = `COMP-${RUN_ID}-SG`;
  const COMP_OTHER = `COMP-${RUN_ID}-OTHER`;
  const EST_UAT_ID = `EST-${RUN_ID}-UAT`;
  const EST_PROD_ID = `EST-${RUN_ID}-PROD`;
  const EST_ZERO_STAFF_ID = `EST-${RUN_ID}-ZERO`;

  let clientId = "";
  let caseId = "";
  let surveyId = "";
  let zeroSurveyId = "";
  let wfTemplateId = "";
  let prevDefaultIds: string[] = [];
  let createdProposalId: string | null = null;

  const savedEnv = {
    enabled: process.env.AHH_WFM_UAT_COSTING_EXCEPTION_ENABLED,
    allowlist: process.env.AHH_WFM_UAT_COSTING_ALLOWLIST,
    users: process.env.AHH_WFM_UAT_COSTING_AUTHORIZED_USERS,
  };

  const mockMaker = {
    id: `USR-${RUN_ID}-MAKER`,
    email: "shana.maker@ahh-uat.local",
    name: "Shana Finance Maker",
    role: "FINANCE_MAKER",
    companyId: COMP_SG,
    permissions: [
      "precontract.costing.view",
      "precontract.costing.manage",
      "precontract.workflow.submit",
      "precontract.proposal.view",
      "precontract.proposal.manage",
      "precontract.proposal.issue",
      "precontract.contractConversion.execute",
    ],
    operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: false },
  };

  const mockChecker = {
    id: `USR-${RUN_ID}-CHECKER`,
    email: "shana.checker@ahh-uat.local",
    name: "Shana Finance Checker",
    role: "FINANCE_CHECKER",
    companyId: COMP_SG,
    permissions: [
      "precontract.costing.view",
      "precontract.workflow.review",
      "precontract.workflow.approve",
      "precontract.proposal.view",
      "precontract.proposal.manage",
      "precontract.proposal.issue",
      "precontract.contractConversion.execute",
    ],
    operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: false },
  };

  const mockViewer = {
    id: `USR-${RUN_ID}-VIEWER`,
    email: "shana.viewer@ahh-uat.local",
    name: "Shana Finance Viewer",
    role: "FINANCE_VIEWER",
    companyId: COMP_SG,
    permissions: ["precontract.costing.view"],
    operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: false },
  };

  const mockUnauthorizedUser = {
    id: `USR-${RUN_ID}-UNAUTH`,
    email: "other.maker@ahh-uat.local",
    name: "Non-UAT Maker",
    role: "FINANCE_MAKER",
    companyId: COMP_SG,
    permissions: [
      "precontract.costing.view",
      "precontract.costing.manage",
      "precontract.workflow.submit",
    ],
    operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: false },
  };

  const mockCrossCompanyMaker = {
    id: `USR-${RUN_ID}-XCOMP`,
    email: "shana.maker@ahh-uat.local",
    name: "Other Company Maker",
    role: "FINANCE_MAKER",
    companyId: COMP_OTHER,
    permissions: [
      "precontract.costing.view",
      "precontract.costing.manage",
      "precontract.workflow.submit",
    ],
    operationAccess: { allowedSecurityGuarding: true, allowedFacilityManagement: false },
  };

  const mockCrossOpFmMaker = {
    id: `USR-${RUN_ID}-FM`,
    email: "shana.maker@ahh-uat.local",
    name: "FM Maker",
    role: "FINANCE_MAKER",
    companyId: COMP_SG,
    permissions: [
      "precontract.costing.view",
      "precontract.costing.manage",
      "precontract.workflow.submit",
    ],
    operationAccess: { allowedSecurityGuarding: false, allowedFacilityManagement: true },
  };

  function setSession(user: any) {
    (getServerSession as jest.Mock).mockResolvedValue(user ? { user } : null);
  }

  function makeReq(url: string, body: any) {
    return new NextRequest(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function resetUatEnv() {
    delete process.env.AHH_WFM_UAT_COSTING_EXCEPTION_ENABLED;
    delete process.env.AHH_WFM_UAT_COSTING_ALLOWLIST;
    delete process.env.AHH_WFM_UAT_COSTING_AUTHORIZED_USERS;
  }

  async function seedCostingEstimate(id: string, targetSurveyId: string, opts: { zeroStaff?: boolean } = {}) {
    await prisma.preContractCostEstimate.create({
      data: {
        id,
        caseId,
        surveyId: targetSurveyId,
        companyId: COMP_SG,
        operationType: "SECURITY_GUARDING",
        currentVersionNumber: 1,
        status: "DRAFT",
        createdBy: mockMaker.id,
        versions: {
          create: {
            versionNumber: 1,
            status: "DRAFT",
            costConfigVersionId: null, // No ACTIVE PC-2A Rate Card
            totalDirectCost: new Decimal(opts.zeroStaff ? 0 : 12000),
            totalIndirectCost: new Decimal(0),
            totalCost: new Decimal(opts.zeroStaff ? 0 : 12000),
            sellingPrice: new Decimal(opts.zeroStaff ? 0 : 14400),
            pricingBasis: "MARGIN",
            targetMarginPercentage: new Decimal(16.67),
            createdBy: mockMaker.id,
            items: {
              create: opts.zeroStaff
                ? []
                : [
                    {
                      elementCode: "BASIC_PAY",
                      elementName: "Security Guard Basic Pay",
                      categoryCode: "DIRECT_LABOR",
                      isDirect: true,
                      quantity: new Decimal(4),
                      unitRate: new Decimal(2000),
                      totalAmount: new Decimal(8000),
                      calculationBasis: "FALLBACK",
                    },
                    {
                      elementCode: "ALLOWANCES",
                      elementName: "Standard Allowances",
                      categoryCode: "DIRECT_LABOR",
                      isDirect: true,
                      quantity: new Decimal(4),
                      unitRate: new Decimal(500),
                      totalAmount: new Decimal(2000),
                      calculationBasis: "FALLBACK",
                    },
                    {
                      elementCode: "RELIEVER_COST",
                      elementName: "Reliever Coverage",
                      categoryCode: "DIRECT_LABOR",
                      isDirect: true,
                      quantity: new Decimal(1),
                      unitRate: new Decimal(2000),
                      totalAmount: new Decimal(2000),
                      calculationBasis: "FALLBACK",
                    },
                  ],
            },
          },
        },
      },
    });
  }

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
          departmentId: null,
          isActive: true,
          employmentStatus: "ACTIVE",
          isLoginEnabled: true,
          isLocked: false,
          webAccessEnabled: true,
          mobileAccessEnabled: true,
        },
      ] as any;
    });
  });

  beforeAll(async () => {
    await prisma.company.createMany({
      data: [
        { id: COMP_SG, companyCode: `SG-${RUN_ID.slice(-6)}`, companyName: "UAT SG Company" },
        { id: COMP_OTHER, companyCode: `OT-${RUN_ID.slice(-6)}`, companyName: "UAT Other Company" },
      ],
      skipDuplicates: true,
    });

    const client = await prisma.preContractProspectClient.create({
      data: {
        name: "UAT Synthetic Prospect Client",
        companyId: COMP_SG,
      },
    });
    clientId = client.id;

    const pcCase = await prisma.preContractCase.create({
      data: {
        title: `UAT Synthetic Case ${RUN_ID}`,
        prospectClientId: clientId,
        companyId: COMP_SG,
        operationType: "SECURITY_GUARDING",
        lifecycle: "DRAFT",
        createdBy: mockMaker.id,
      },
    });
    caseId = pcCase.id;

    const survey = await prisma.preContractSurvey.create({
      data: {
        caseId,
        lifecycle: "COMPLETED",
        responses: {
          create: [
            { elementCode: "HEADCOUNT", numericValue: 4 },
            { elementCode: "RELIEVER_REQUIRED", booleanValue: true },
          ],
        },
      },
    });
    surveyId = survey.id;

    const zeroSurvey = await prisma.preContractSurvey.create({
      data: {
        caseId,
        lifecycle: "COMPLETED",
        responses: {
          create: [
            { elementCode: "HEADCOUNT", numericValue: 4 },
          ],
        },
      },
    });
    zeroSurveyId = zeroSurvey.id;

    const prevDefaults = await prisma.workflowTemplate.findMany({
      where: {
        moduleType: { in: ["PRE_CONTRACT_COSTING", "COMMERCIAL_COSTING", "COSTING"] },
        isActive: true,
        isDefault: true,
      },
      select: { id: true },
    });
    prevDefaultIds = prevDefaults.map((t: any) => t.id);
    if (prevDefaultIds.length > 0) {
      await prisma.workflowTemplate.updateMany({
        where: { id: { in: prevDefaultIds } },
        data: { isDefault: false },
      });
    }

    const tpl = await prisma.workflowTemplate.create({
      data: {
        workflowName: `DEF104 UAT Costing Template ${RUN_ID}`,
        moduleType: "PRE_CONTRACT_COSTING",
        appliesTo: "APPROVAL",
        isActive: true,
        isDefault: true,
        levels: {
          create: [
            {
              levelNumber: 1,
              levelName: "Finance Checker Review",
              approvers: {
                create: [{ approverType: "ROLE_BASED", roleName: "FINANCE_CHECKER" }],
              },
            },
          ],
        },
      },
    });
    wfTemplateId = tpl.id;

    await seedCostingEstimate(EST_UAT_ID, surveyId);
    await seedCostingEstimate(EST_PROD_ID, surveyId);
    await seedCostingEstimate(EST_ZERO_STAFF_ID, zeroSurveyId, { zeroStaff: true });
  });

  afterEach(() => {
    resetUatEnv();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    process.env.AHH_WFM_UAT_COSTING_EXCEPTION_ENABLED = savedEnv.enabled;
    process.env.AHH_WFM_UAT_COSTING_ALLOWLIST = savedEnv.allowlist;
    process.env.AHH_WFM_UAT_COSTING_AUTHORIZED_USERS = savedEnv.users;

    await prisma.userActivityLog.deleteMany({
      where: { entityId: { in: [EST_UAT_ID, EST_PROD_ID, EST_ZERO_STAFF_ID] } },
    });
    if (createdProposalId) {
      await prisma.preContractProposalVersion.deleteMany({ where: { proposalId: createdProposalId } });
      await prisma.preContractProposal.deleteMany({ where: { id: createdProposalId } });
    }
    await prisma.workflowActionHistory.deleteMany({
      where: { instance: { referenceId: { in: [EST_UAT_ID, EST_PROD_ID, EST_ZERO_STAFF_ID] } } },
    });
    await prisma.workflowInstance.deleteMany({
      where: { referenceId: { in: [EST_UAT_ID, EST_PROD_ID, EST_ZERO_STAFF_ID] } },
    });
    await prisma.preContractCostEstimateItem.deleteMany({
      where: { estimateVersion: { estimateId: { in: [EST_UAT_ID, EST_PROD_ID, EST_ZERO_STAFF_ID] } } },
    });
    await prisma.preContractCostEstimateVersion.deleteMany({
      where: { estimateId: { in: [EST_UAT_ID, EST_PROD_ID, EST_ZERO_STAFF_ID] } },
    });
    await prisma.preContractCostEstimate.deleteMany({
      where: { id: { in: [EST_UAT_ID, EST_PROD_ID, EST_ZERO_STAFF_ID] } },
    });
    if (wfTemplateId) {
      await prisma.workflowTemplateApprover.deleteMany({ where: { level: { templateId: wfTemplateId } } });
      await prisma.workflowTemplateLevel.deleteMany({ where: { templateId: wfTemplateId } });
      await prisma.workflowTemplate.deleteMany({ where: { id: wfTemplateId } });
    }
    if (prevDefaultIds.length > 0) {
      await prisma.workflowTemplate.updateMany({
        where: { id: { in: prevDefaultIds } },
        data: { isDefault: true },
      });
    }
    await prisma.surveyResponse.deleteMany({ where: { surveyId: { in: [surveyId, zeroSurveyId] } } });
    await prisma.preContractSurvey.deleteMany({ where: { id: { in: [surveyId, zeroSurveyId] } } });
    if (caseId) await prisma.preContractCase.deleteMany({ where: { id: caseId } });
    if (clientId) await prisma.preContractProspectClient.deleteMany({ where: { id: clientId } });
    await prisma.company.deleteMany({ where: { id: { in: [COMP_SG, COMP_OTHER] } } });
  });

  test("1. Disabled by default: SUBMIT is blocked (400) when feature flag is not enabled", async () => {
    setSession(mockMaker);
    const res = await postCostingWorkflow(
      makeReq(`http://localhost:3100/api/v1/commercial/costing/${EST_UAT_ID}/workflow`, {
        action: "SUBMIT",
        remarks: "Shana UAT run",
      }),
      { params: { id: EST_UAT_ID } }
    );
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/No active PC-2A Rate Card|FALLBACK/i);
  });

  test("2. Allowlist strictness: wildcard '*' and non-allowlisted records are rejected (400)", async () => {
    setSession(mockMaker);
    process.env.AHH_WFM_UAT_COSTING_EXCEPTION_ENABLED = "true";
    process.env.AHH_WFM_UAT_COSTING_ALLOWLIST = "*";
    process.env.AHH_WFM_UAT_COSTING_AUTHORIZED_USERS = "shana.maker@ahh-uat.local";

    const wildcardRes = await postCostingWorkflow(
      makeReq(`http://localhost:3100/api/v1/commercial/costing/${EST_UAT_ID}/workflow`, {
        action: "SUBMIT",
        remarks: "Wildcard attempt",
      }),
      { params: { id: EST_UAT_ID } }
    );
    expect(wildcardRes.status).toBe(400);

    process.env.AHH_WFM_UAT_COSTING_ALLOWLIST = EST_UAT_ID;
    const prodRes = await postCostingWorkflow(
      makeReq(`http://localhost:3100/api/v1/commercial/costing/${EST_PROD_ID}/workflow`, {
        action: "SUBMIT",
        remarks: "Non-allowlisted record",
      }),
      { params: { id: EST_PROD_ID } }
    );
    expect(prodRes.status).toBe(400);
  });

  test("3. Security & RBAC: Finance Viewer, non-UAT user, cross-company, and cross-operation users are blocked", async () => {
    process.env.AHH_WFM_UAT_COSTING_EXCEPTION_ENABLED = "true";
    process.env.AHH_WFM_UAT_COSTING_ALLOWLIST = EST_UAT_ID;
    process.env.AHH_WFM_UAT_COSTING_AUTHORIZED_USERS = "shana.maker@ahh-uat.local,shana.checker@ahh-uat.local";

    setSession(mockViewer);
    const viewerRes = await postCostingWorkflow(
      makeReq(`http://localhost:3100/api/v1/commercial/costing/${EST_UAT_ID}/workflow`, { action: "SUBMIT" }),
      { params: { id: EST_UAT_ID } }
    );
    expect(viewerRes.status).toBe(403);

    setSession(mockUnauthorizedUser);
    const unauthRes = await postCostingWorkflow(
      makeReq(`http://localhost:3100/api/v1/commercial/costing/${EST_UAT_ID}/workflow`, { action: "SUBMIT" }),
      { params: { id: EST_UAT_ID } }
    );
    expect(unauthRes.status).toBe(400);

    setSession(mockCrossCompanyMaker);
    const xCompRes = await postCostingWorkflow(
      makeReq(`http://localhost:3100/api/v1/commercial/costing/${EST_UAT_ID}/workflow`, { action: "SUBMIT" }),
      { params: { id: EST_UAT_ID } }
    );
    expect(xCompRes.status).toBe(403);

    setSession(mockCrossOpFmMaker);
    const fmRes = await postCostingWorkflow(
      makeReq(`http://localhost:3100/api/v1/commercial/costing/${EST_UAT_ID}/workflow`, { action: "SUBMIT" }),
      { params: { id: EST_UAT_ID } }
    );
    expect(fmRes.status).toBe(403);
  });

  test("4. Mandatory staffing/headcount check is NEVER bypassed even when allowlisted", async () => {
    setSession(mockMaker);
    process.env.AHH_WFM_UAT_COSTING_EXCEPTION_ENABLED = "true";
    process.env.AHH_WFM_UAT_COSTING_ALLOWLIST = EST_ZERO_STAFF_ID;
    process.env.AHH_WFM_UAT_COSTING_AUTHORIZED_USERS = "shana.maker@ahh-uat.local";

    const res = await postCostingWorkflow(
      makeReq(`http://localhost:3100/api/v1/commercial/costing/${EST_ZERO_STAFF_ID}/workflow`, {
        action: "SUBMIT",
        remarks: "Zero staffing attempt",
      }),
      { params: { id: EST_ZERO_STAFF_ID } }
    );
    expect(res.status).toBe(400);
  });

  test("5. End-to-End UAT Flow: SUBMIT -> Maker self-approve blocked -> Checker APPROVE -> Proposal created -> Issue & Convert HARD-BLOCKED", async () => {
    process.env.AHH_WFM_UAT_COSTING_EXCEPTION_ENABLED = "true";
    process.env.AHH_WFM_UAT_COSTING_ALLOWLIST = EST_UAT_ID;
    process.env.AHH_WFM_UAT_COSTING_AUTHORIZED_USERS = "shana.maker@ahh-uat.local,shana.checker@ahh-uat.local";

    // A. Authorized Maker SUBMITS allowlisted UAT costing
    setSession(mockMaker);
    const submitRes = await postCostingWorkflow(
      makeReq(`http://localhost:3100/api/v1/commercial/costing/${EST_UAT_ID}/workflow`, {
        action: "SUBMIT",
        remarks: "Shana UAT Run 3 Day 9 E2E verification",
      }),
      { params: { id: EST_UAT_ID } }
    );
    const submitBody = await submitRes.json();
    expect(submitRes.status).toBe(200);
    expect(submitBody.uatException?.active).toBe(true);
    expect(submitBody.uatException?.banner).toBe(UAT_UNVALIDATED_COSTING_BANNER);
    expect(submitBody.estimate?.uatUnvalidatedBanner).toBe(UAT_UNVALIDATED_COSTING_BANNER);
    expect(submitBody.estimate?.validationSummary?.blocksCommercialSubmission).toBe(true);
    expect(submitBody.uatException?.bypassedChecks).toEqual(
      expect.arrayContaining([
        "NO_ACTIVE_PC2A_RATE_CARD",
        "FALLBACK_RATE:BASIC_PAY",
        "FALLBACK_RATE:ALLOWANCES",
        "FALLBACK_RATE:RELIEVER_COST",
      ])
    );

    const wfInstanceId = submitBody.workflow?.instanceId;
    expect(wfInstanceId).toBeTruthy();

    // B. Maker self-approval is still blocked (Segregation of Duties — even if maker also held approve perm)
    setSession({
      ...mockMaker,
      role: "FINANCE_CHECKER",
      permissions: [...mockMaker.permissions, "precontract.workflow.approve"],
    });
    const selfApproveRes = await postApprovalAction(
      makeReq(`http://localhost:3100/api/v1/approvals/${wfInstanceId}/action`, {
        action: "APPROVE",
        remarks: "Self-approve attempt",
      }),
      { params: { id: wfInstanceId } }
    );
    expect(selfApproveRes.status).toBe(403);

    // C. Authorized Checker APPROVES via Approval Center
    setSession(mockChecker);
    const approveRes = await postApprovalAction(
      makeReq(`http://localhost:3100/api/v1/approvals/${wfInstanceId}/action`, {
        action: "APPROVE",
        remarks: "Shana UAT Checker Approval",
      }),
      { params: { id: wfInstanceId } }
    );
    const approveBody = await approveRes.json();
    expect(approveRes.status).toBe(200);
    expect(approveBody.uatException?.active).toBe(true);
    expect(approveBody.uatException?.banner).toBe(UAT_UNVALIDATED_COSTING_BANNER);

    // Verify audit logs recorded both SUBMIT and APPROVE with user, reason, date, and bypassedChecks
    const auditLogs = await prisma.userActivityLog.findMany({
      where: {
        entityId: EST_UAT_ID,
        action: "UAT_COSTING_FALLBACK_EXCEPTION",
      },
      orderBy: { createdAt: "asc" },
    });
    expect(auditLogs.length).toBe(2);
    const submitAudit = JSON.parse(auditLogs[0].afterJson || "{}");
    const approveAudit = JSON.parse(auditLogs[1].afterJson || "{}");
    expect(submitAudit.action).toBe("SUBMIT");
    expect(submitAudit.userId).toBe(mockMaker.id);
    expect(submitAudit.reason).toBe("Shana UAT Run 3 Day 9 E2E verification");
    expect(submitAudit.recordedAt).toBeTruthy();
    expect(approveAudit.action).toBe("APPROVE");
    expect(approveAudit.userId).toBe(mockChecker.id);
    expect(approveAudit.reason).toBe("Shana UAT Checker Approval");

    // D. Proposal Creation from UAT-approved costing succeeds
    setSession(mockMaker);
    const latestEst = await prisma.preContractCostEstimate.findUnique({
      where: { id: EST_UAT_ID },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    const propRes = await postProposals(
      makeReq("http://localhost:3100/api/v1/commercial/proposals", {
        caseId,
        costEstimateId: EST_UAT_ID,
        costEstimateVersionId: latestEst!.versions[0].id,
        title: "UAT Synthetic Security Proposal",
      })
    );
    const propBody = await propRes.json();
    expect([200, 201]).toContain(propRes.status);
    createdProposalId = propBody.proposal?.id || propBody.id;
    expect(createdProposalId).toBeTruthy();

    // Mark proposal APPROVED_INTERNAL to prove even an approved UAT proposal cannot be issued or converted
    await prisma.preContractProposal.update({
      where: { id: createdProposalId! },
      data: { status: "APPROVED_INTERNAL" },
    });
    await prisma.preContractProposalVersion.updateMany({
      where: { proposalId: createdProposalId! },
      data: { status: "APPROVED_INTERNAL" },
    });

    // E. Client Issuance is HARD-BLOCKED (400) with UAT banner
    const issueRes = await postProposalIssue(
      makeReq(`http://localhost:3100/api/v1/commercial/proposals/${createdProposalId}/issue`, {
        clientEmail: "real-client@example.com",
      }),
      { params: { id: createdProposalId! } }
    );
    const issueBody = await issueRes.json();
    expect(issueRes.status).toBe(400);
    expect(issueBody.error).toContain(UAT_UNVALIDATED_COSTING_BANNER);
    expect(issueBody.uatBanner).toBe(UAT_UNVALIDATED_COSTING_BANNER);

    // F. Contract Conversion is HARD-BLOCKED (400) with UAT banner
    await prisma.preContractProposal.update({
      where: { id: createdProposalId! },
      data: { status: "CLIENT_ACCEPTED" },
    });
    const convertRes = await postProposalConvert(
      makeReq(`http://localhost:3100/api/v1/commercial/proposals/${createdProposalId}/convert`, {
        contractNumber: `CNT-${RUN_ID}`,
        startDate: "2026-12-01",
        endDate: "2027-11-30",
      }),
      { params: { id: createdProposalId! } }
    );
    const convertBody = await convertRes.json();
    expect(convertRes.status).toBe(400);
    expect(convertBody.error).toContain(UAT_UNVALIDATED_COSTING_BANNER);
    expect(convertBody.uatBanner).toBe(UAT_UNVALIDATED_COSTING_BANNER);
  });
});
