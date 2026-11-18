import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { NextRequest } from "next/server";

import { POST as createCostingRoute } from "../../apps/web/app/api/v1/commercial/costing/route";
import { GET as getCostingDetailRoute, PATCH as patchCostingDetailRoute } from "../../apps/web/app/api/v1/commercial/costing/[id]/route";
import { POST as costingWorkflowRoute } from "../../apps/web/app/api/v1/commercial/costing/[id]/workflow/route";
import { POST as createProposalRoute } from "../../apps/web/app/api/v1/commercial/proposals/route";
import { POST as proposalWorkflowRoute } from "../../apps/web/app/api/v1/commercial/proposals/[id]/workflow/route";
import { POST as issueProposalRoute } from "../../apps/web/app/api/v1/commercial/proposals/[id]/issue/route";
import { POST as executeApprovalActionRoute } from "../../apps/web/app/api/v1/approvals/[id]/action/route";
import { assessCostingValidation } from "../../apps/web/lib/precontract-costing";
import { DEFAULT_ROLE_PERMISSIONS } from "../../apps/web/lib/permissions";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

describe("DEF-104 Commercial Costing Protection (TEST DATABASE)", () => {
  const rand = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  let companyId: string;
  let oppId: string;
  let unmappedSurveyId: string;
  let legacyApprovedEstId: string;
  let unmappedEstId: string;
  let proposalId: string;
  let costingTplId: string;
  let proposalTplId: string;
  let prevCostingDefaults: string[] = [];
  let prevProposalDefaults: string[] = [];

  const makerId = `emp-d104-mk-${rand}`;
  const checkerId = `emp-d104-ck-${rand}`;

  const makerSession = (withOverride: boolean = true) => ({
    id: makerId,
    employeeId: makerId,
    name: "DEF104 Maker",
    email: `d104-maker-${rand}@test.local`,
    role: "COMMERCIAL_MAKER",
    companyId,
    operationAccess: { allowedSecurityGuarding: true },
    permissions: [
      ...DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_MAKER,
      "precontract.workflow.submit",
      "precontract.costing.manage",
      ...(withOverride ? ["precontract.costing.override"] : []),
      "precontract.proposal.manage",
      "precontract.proposal.issue",
    ],
  });

  const checkerSession = () => ({
    id: checkerId,
    employeeId: checkerId,
    name: "DEF104 Checker",
    email: `d104-checker-${rand}@test.local`,
    role: "COMMERCIAL_CHECKER",
    companyId,
    operationAccess: { allowedSecurityGuarding: true },
    permissions: [
      ...DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_CHECKER,
      "precontract.workflow.approve",
      "precontract.workflow.review",
    ],
  });

  beforeAll(async () => {
    const comp = await prisma.company.create({
      data: { companyCode: `D104-${rand}`, companyName: `DEF104 Co ${rand}`, isActive: true },
    });
    companyId = comp.id;

    const prevC = await prisma.workflowTemplate.findMany({
      where: { isActive: true, isDefault: true, moduleType: "PRE_CONTRACT_COSTING" },
      select: { id: true },
    });
    prevCostingDefaults = prevC.map((t) => t.id);
    if (prevCostingDefaults.length > 0) {
      await prisma.workflowTemplate.updateMany({ where: { id: { in: prevCostingDefaults } }, data: { isDefault: false } });
    }

    const prevP = await prisma.workflowTemplate.findMany({
      where: { isActive: true, isDefault: true, moduleType: "PRE_CONTRACT_PROPOSAL" },
      select: { id: true },
    });
    prevProposalDefaults = prevP.map((t) => t.id);
    if (prevProposalDefaults.length > 0) {
      await prisma.workflowTemplate.updateMany({ where: { id: { in: prevProposalDefaults } }, data: { isDefault: false } });
    }

    costingTplId = (
      await prisma.workflowTemplate.create({
        data: {
          workflowName: `DEF104 Costing ${rand}`,
          moduleType: "PRE_CONTRACT_COSTING",
          appliesTo: "ACTIVATION",
          operationType: "SECURITY_GUARDING",
          isDefault: true,
          isActive: true,
          levels: {
            create: [
              {
                levelNumber: 1,
                levelName: "Checker",
                approvalRule: "ANY_ONE",
                isMandatory: true,
                approvers: { create: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: checkerId, employeeName: "DEF104 Checker" }] },
              },
            ],
          },
        },
      })
    ).id;

    proposalTplId = (
      await prisma.workflowTemplate.create({
        data: {
          workflowName: `DEF104 Proposal ${rand}`,
          moduleType: "PRE_CONTRACT_PROPOSAL",
          appliesTo: "ACTIVATION",
          operationType: "SECURITY_GUARDING",
          isDefault: true,
          isActive: true,
          levels: {
            create: [
              {
                levelNumber: 1,
                levelName: "Checker",
                approvalRule: "ANY_ONE",
                isMandatory: true,
                approvers: { create: [{ approverType: "SPECIFIC_EMPLOYEE", employeeId: checkerId, employeeName: "DEF104 Checker" }] },
              },
            ],
          },
        },
      })
    ).id;

    oppId = (
      await prisma.preContractCase.create({
        data: {
          title: `DEF104 Opp ${rand}`,
          companyId,
          operationType: "SECURITY_GUARDING",
          lifecycle: "COMPLETED",
          businessOutcome: "IN_PROGRESS",
          createdBy: makerId,
        },
      })
    ).id;

    unmappedSurveyId = (
      await prisma.preContractSurvey.create({
        data: {
          caseId: oppId,
          companyId,
          operationType: "SECURITY_GUARDING",
          lifecycle: "COMPLETED",
          conductedBy: makerId,
          responses: {
            create: [
              { elementCode: "ELEM_POST_COUNT", numericValue: 12 },
              { elementCode: "ELEM_SHIFT_PATTERN", textValue: "24/7" },
            ],
          },
        },
      })
    ).id;
  });

  afterAll(async () => {
    try {
      if (proposalId) {
        await prisma.proposalIssuanceLog.deleteMany({ where: { proposalVersion: { proposalId } } });
        await prisma.preContractProposalVersion.deleteMany({ where: { proposalId } });
        await prisma.workflowInstance.deleteMany({ where: { referenceId: proposalId } });
        await prisma.preContractProposal.deleteMany({ where: { id: proposalId } });
      }
      for (const eid of [unmappedEstId, legacyApprovedEstId].filter(Boolean)) {
        await prisma.preContractCostEstimateVersion.deleteMany({ where: { estimateId: eid } });
        await prisma.workflowInstance.deleteMany({ where: { referenceId: eid } });
        await prisma.preContractCostEstimate.deleteMany({ where: { id: eid } });
      }
      await prisma.surveyResponse.deleteMany({ where: { surveyId: unmappedSurveyId } });
      await prisma.preContractSurvey.deleteMany({ where: { id: unmappedSurveyId } });
      await prisma.preContractCase.deleteMany({ where: { id: oppId } });
      await prisma.workflowTemplate.deleteMany({ where: { id: { in: [costingTplId, proposalTplId] } } });
      if (prevCostingDefaults.length > 0) {
        await prisma.workflowTemplate.updateMany({ where: { id: { in: prevCostingDefaults } }, data: { isDefault: true } });
      }
      if (prevProposalDefaults.length > 0) {
        await prisma.workflowTemplate.updateMany({ where: { id: { in: prevProposalDefaults } }, data: { isDefault: true } });
      }
      await prisma.company.deleteMany({ where: { id: companyId } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it("1-4. Identifies unmapped survey fields & fallback rates, blocks Costing submission/approval, and blocks Proposal issuance", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: makerSession(true) });
    const createRes = await createCostingRoute(
      new Request("http://localhost:3100/api/v1/commercial/costing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: oppId, surveyId: unmappedSurveyId }),
      })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    unmappedEstId = created.estimate.id;

    // 1 & 2: Missing/unmapped survey-driven quantity & hardcoded fallback rates identified
    expect(created.estimate.validationSummary.assumedFallbackHeadcount).toBe(true);
    expect(created.estimate.validationSummary.unmappedSurveyManpowerFields).toEqual(
      expect.arrayContaining(["ELEM_POST_COUNT", "ELEM_SHIFT_PATTERN"])
    );
    expect(created.estimate.validationSummary.usesFallbackRates).toBe(true);
    expect(created.estimate.validationSummary.blocksCommercialSubmission).toBe(true);
    expect(created.estimate.versions[0].items.find((i: any) => i.elementCode === "BASIC_PAY")?.calculationBasis).toBe("FALLBACK");

    // 3: Unvalidated Costing cannot be submitted
    const subRes = await costingWorkflowRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${unmappedEstId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT" }),
      }),
      { params: { id: unmappedEstId } }
    );
    expect(subRes.status).toBe(400);

    // 4: Even if a legacy/manual Proposal exists pointing to an unvalidated Costing version, issuance is blocked (400)
    const prop = await prisma.preContractProposal.create({
      data: {
        caseId: oppId,
        companyId,
        operationType: "SECURITY_GUARDING",
        status: "APPROVED_INTERNAL",
        createdBy: makerId,
        versions: {
          create: {
            versionNumber: 1,
            costEstimateId: unmappedEstId,
            costEstimateVersionId: created.estimate.versions[0].id,
            title: "Unvalidated Proposal Test",
            status: "APPROVED_INTERNAL",
            currency: "QAR",
            sellingPrice: created.estimate.versions[0].sellingPrice,
            createdBy: makerId,
          },
        },
      },
    });
    proposalId = prop.id;

    const issueRes = await issueProposalRoute(
      new NextRequest(`http://localhost:3100/api/v1/commercial/proposals/${proposalId}/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientName: "Client X" }),
      }),
      { params: { id: proposalId } }
    );
    expect(issueRes.status).toBe(400);
    const issueData = await issueRes.json();
    expect(issueData.error).toContain("DEF-104 Issuance Guard");
  });

  it("5-6. Unauthorized users cannot override (403); authorized estimator override unblocks Costing & records PreContractCostOverrideLog", async () => {
    // 6: Unauthorized user without precontract.costing.override gets 403
    (getServerSession as jest.Mock).mockResolvedValue({ user: makerSession(false) });
    const unauthPatch = await patchCostingDetailRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${unmappedEstId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: [{ elementCode: "BASIC_PAY", quantity: 12, unitRate: 2800, reason: "Unauthorized attempt" }],
        }),
      }),
      { params: { id: unmappedEstId } }
    );
    expect(unauthPatch.status).toBe(403);

    // 5: Authorized estimator overrides BASIC_PAY & ALLOWANCES with survey headcount 12
    (getServerSession as jest.Mock).mockResolvedValue({ user: makerSession(true) });
    const authPatch = await patchCostingDetailRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${unmappedEstId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: [
            { elementCode: "BASIC_PAY", quantity: 12, unitRate: 2800, reason: "Confirmed 12 guards from survey ELEM_POST_COUNT" },
            { elementCode: "ALLOWANCES", quantity: 12, unitRate: 1000, reason: "Confirmed allowance for 12 guards" },
          ],
        }),
      }),
      { params: { id: unmappedEstId } }
    );
    expect(authPatch.status).toBe(200);
    const patched = await authPatch.json();
    expect(patched.estimate.validationSummary.validationStatus).toBe("VALIDATED_BY_OVERRIDE");
    expect(patched.estimate.validationSummary.blocksCommercialSubmission).toBe(false);
    expect(patched.estimate.versions[0].overrides.length).toBe(2);
    expect(Number(patched.estimate.versions[0].items.find((i: any) => i.elementCode === "BASIC_PAY").quantity)).toBe(12);

    // Now Costing SUBMIT and Approval Center APPROVE succeed cleanly
    const subRes = await costingWorkflowRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${unmappedEstId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT" }),
      }),
      { params: { id: unmappedEstId } }
    );
    expect(subRes.status).toBe(200);
    const wfId = (await subRes.json()).workflow.instanceId;

    (getServerSession as jest.Mock).mockResolvedValue({ user: checkerSession() });
    const appRes = await executeApprovalActionRoute(
      new NextRequest(`http://localhost:3100/api/v1/approvals/${wfId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", remarks: "Approved after DEF-104 override" }),
      }),
      { params: { id: wfId } }
    );
    expect(appRes.status).toBe(200);
  });

  it("7. Previously approved legacy records without CostConfigurationVersion/overrides are NOT silently marked validated", async () => {
    const legacyEst = await prisma.preContractCostEstimate.create({
      data: {
        caseId: oppId,
        surveyId: unmappedSurveyId,
        companyId,
        operationType: "SECURITY_GUARDING",
        status: "APPROVED",
        createdBy: makerId,
        versions: {
          create: {
            versionNumber: 1,
            status: "APPROVED",
            pricingBasis: "MARGIN",
            currency: "QAR",
            totalDirectCost: 3500,
            totalIndirectCost: 350,
            totalCost: 3850,
            sellingPrice: 4529.41,
            snapshotJson: "{}",
            checksum: "legacy-checksum-immutable",
            createdBy: makerId,
          },
        },
      },
      include: {
        survey: { include: { responses: true } },
        versions: { include: { items: true, overrides: true } },
      },
    });
    legacyApprovedEstId = legacyEst.id;

    const legacySummary = assessCostingValidation(legacyEst.survey.responses, legacyEst.versions[0]);
    expect(legacySummary.validationStatus).toBe("UNVALIDATED_LEGACY_APPROVED");
    expect(legacySummary.isValidated).toBe(false);

    (getServerSession as jest.Mock).mockResolvedValue({ user: makerSession(true) });
    const getRes = await getCostingDetailRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${legacyApprovedEstId}`),
      { params: { id: legacyApprovedEstId } }
    );
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.estimate.validationSummary.validationStatus).toBe("UNVALIDATED_LEGACY_APPROVED");
    expect(getData.estimate.versions[0].checksum).toBe("legacy-checksum-immutable");
  });
});
