import { prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { NextRequest } from "next/server";

import { POST as createCostingRoute } from "../../apps/web/app/api/v1/commercial/costing/route";
import { GET as getCostingDetailRoute, PATCH as patchCostingDetailRoute } from "../../apps/web/app/api/v1/commercial/costing/[id]/route";
import { POST as costingWorkflowRoute } from "../../apps/web/app/api/v1/commercial/costing/[id]/workflow/route";
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
  let otherCompanyId: string;
  let oppId: string;
  let unmappedShiftSurveyId: string;
  let postCountOnlySurveyId: string;
  let legacyApprovedEstId: string;
  let unmappedShiftEstId: string;
  let postCountEstId: string;
  let proposalId: string;
  let costingTplId: string;
  let proposalTplId: string;
  let prevCostingDefaults: string[] = [];
  let prevProposalDefaults: string[] = [];

  const makerId = `emp-d104-mk-${rand}`;
  const checkerId = `emp-d104-ck-${rand}`;

  const makerSession = (withOverride: boolean = true, compId: string = companyId) => ({
    id: makerId,
    employeeId: makerId,
    name: "DEF104 Maker",
    email: `d104-maker-${rand}@test.local`,
    role: "COMMERCIAL_MAKER",
    companyId: compId,
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
    companyId = (
      await prisma.company.create({
        data: { companyCode: `D104-${rand}`, companyName: `DEF104 Co ${rand}`, isActive: true },
      })
    ).id;
    otherCompanyId = (
      await prisma.company.create({
        data: { companyCode: `D104B-${rand}`, companyName: `DEF104 Other ${rand}`, isActive: true },
      })
    ).id;

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

    unmappedShiftSurveyId = (
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

    postCountOnlySurveyId = (
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
              { elementCode: "RELIEVER_REQUIRED", booleanValue: true },
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
      for (const eid of [unmappedShiftEstId, postCountEstId, legacyApprovedEstId].filter(Boolean)) {
        await prisma.preContractCostEstimateVersion.deleteMany({ where: { estimateId: eid } });
        await prisma.workflowInstance.deleteMany({ where: { referenceId: eid } });
        await prisma.preContractCostEstimate.deleteMany({ where: { id: eid } });
      }
      await prisma.surveyResponse.deleteMany({ where: { surveyId: { in: [unmappedShiftSurveyId, postCountOnlySurveyId] } } });
      await prisma.preContractSurvey.deleteMany({ where: { id: { in: [unmappedShiftSurveyId, postCountOnlySurveyId] } } });
      await prisma.preContractCase.deleteMany({ where: { id: oppId } });
      await prisma.workflowTemplate.deleteMany({ where: { id: { in: [costingTplId, proposalTplId] } } });
      if (prevCostingDefaults.length > 0) {
        await prisma.workflowTemplate.updateMany({ where: { id: { in: prevCostingDefaults } }, data: { isDefault: true } });
      }
      if (prevProposalDefaults.length > 0) {
        await prisma.workflowTemplate.updateMany({ where: { id: { in: prevProposalDefaults } }, data: { isDefault: true } });
      }
      await prisma.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it("1, 2 & 6. Unmapped survey inputs blocked; overriding BASIC_PAY alone (rate-only or with unmapped ELEM_SHIFT_PATTERN) does NOT bypass validation; Proposal issuance blocked", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: makerSession(true) });
    const createRes = await createCostingRoute(
      new Request("http://localhost:3100/api/v1/commercial/costing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: oppId, surveyId: unmappedShiftSurveyId }),
      })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    unmappedShiftEstId = created.estimate.id;

    expect(created.estimate.validationSummary.blocksCommercialSubmission).toBe(true);
    expect(created.estimate.validationSummary.unmappedSurveyManpowerFields).toEqual(
      expect.arrayContaining(["ELEM_POST_COUNT", "ELEM_SHIFT_PATTERN"])
    );

    // Rate-only BASIC_PAY override must NOT bypass ELEM_POST_COUNT or ELEM_SHIFT_PATTERN
    const rateOnlyPatch = await patchCostingDetailRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${unmappedShiftEstId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: [{ elementCode: "BASIC_PAY", unitRate: 2800, reason: "Rate-only adjustment" }],
        }),
      }),
      { params: { id: unmappedShiftEstId } }
    );
    expect(rateOnlyPatch.status).toBe(200);
    const rateOnlyData = await rateOnlyPatch.json();
    expect(rateOnlyData.estimate.validationSummary.assumedFallbackHeadcount).toBe(true);
    expect(rateOnlyData.estimate.validationSummary.blocksCommercialSubmission).toBe(true);

    // Even BASIC_PAY + ALLOWANCES override with quantity=12 must NOT bypass unmapped ELEM_SHIFT_PATTERN
    const shiftBypassAttempt = await patchCostingDetailRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${unmappedShiftEstId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: [
            { elementCode: "BASIC_PAY", quantity: 12, unitRate: 2800, reason: "Override basic pay" },
            { elementCode: "ALLOWANCES", quantity: 12, unitRate: 1000, reason: "Override allowances" },
          ],
        }),
      }),
      { params: { id: unmappedShiftEstId } }
    );
    expect(shiftBypassAttempt.status).toBe(200);
    const shiftBypassData = await shiftBypassAttempt.json();
    expect(shiftBypassData.estimate.validationSummary.blocksCommercialSubmission).toBe(true);

    const subBlocked = await costingWorkflowRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${unmappedShiftEstId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT" }),
      }),
      { params: { id: unmappedShiftEstId } }
    );
    expect(subBlocked.status).toBe(400);

    // Proposal issuance against unvalidated costing is blocked (400)
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
            costEstimateId: unmappedShiftEstId,
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
    expect((await issueRes.json()).error).toContain("DEF-104 Issuance Guard");
  });

  it("3, 4, 5 & 8. Invalid qty/rate rejected (400); unauthorized & cross-company rejected (403); full authorized override unblocks workflow", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: makerSession(true) });
    const createRes = await createCostingRoute(
      new Request("http://localhost:3100/api/v1/commercial/costing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: oppId, surveyId: postCountOnlySurveyId }),
      })
    );
    expect(createRes.status).toBe(201);
    postCountEstId = (await createRes.json()).estimate.id;

    // 4: Invalid quantity (0) and negative unitRate rejected (400)
    const badQtyRes = await patchCostingDetailRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${postCountEstId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: [{ elementCode: "BASIC_PAY", quantity: 0, unitRate: 2800, reason: "Zero qty" }],
        }),
      }),
      { params: { id: postCountEstId } }
    );
    expect(badQtyRes.status).toBe(400);

    const badRateRes = await patchCostingDetailRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${postCountEstId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: [{ elementCode: "BASIC_PAY", quantity: 12, unitRate: -50, reason: "Negative rate" }],
        }),
      }),
      { params: { id: postCountEstId } }
    );
    expect(badRateRes.status).toBe(400);

    const shortReasonRes = await patchCostingDetailRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${postCountEstId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: [{ elementCode: "BASIC_PAY", quantity: 12, unitRate: 2800, reason: "  " }],
        }),
      }),
      { params: { id: postCountEstId } }
    );
    expect(shortReasonRes.status).toBe(400);

    // 5: Unauthorized user (missing permission) & cross-company user rejected (403) without mutation
    (getServerSession as jest.Mock).mockResolvedValue({ user: makerSession(false) });
    const unauthPatch = await patchCostingDetailRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${postCountEstId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: [{ elementCode: "BASIC_PAY", quantity: 12, unitRate: 2800, reason: "Unauthorized attempt" }],
        }),
      }),
      { params: { id: postCountEstId } }
    );
    expect(unauthPatch.status).toBe(403);

    (getServerSession as jest.Mock).mockResolvedValue({ user: makerSession(true, otherCompanyId) });
    const crossCompPatch = await patchCostingDetailRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${postCountEstId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: [{ elementCode: "BASIC_PAY", quantity: 12, unitRate: 2800, reason: "Cross-company attempt" }],
        }),
      }),
      { params: { id: postCountEstId } }
    );
    expect(crossCompPatch.status).toBe(403);

    // 3 & 8: Authorized override of BASIC_PAY + ALLOWANCES persists audit logs;
    // under OPP6, unmapped survey headcount STILL blocks commercial submission until Operations maps headcount
    (getServerSession as jest.Mock).mockResolvedValue({ user: makerSession(true) });
    const validPatch = await patchCostingDetailRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${postCountEstId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: [
            { elementCode: "BASIC_PAY", quantity: 12, unitRate: 2800, reason: "Confirmed 12 guards from survey" },
            { elementCode: "ALLOWANCES", quantity: 12, unitRate: 1000, reason: "Confirmed 12 guards allowances" },
          ],
        }),
      }),
      { params: { id: postCountEstId } }
    );
    expect(validPatch.status).toBe(200);
    const patched = await validPatch.json();
    // RELIEVER_COST remains FALLBACK because RELIEVER_REQUIRED=true and only BASIC_PAY + ALLOWANCES were overridden
    expect(patched.estimate.validationSummary.validationStatus).toBe("UNVALIDATED_FALLBACK");
    expect(patched.estimate.validationSummary.fallbackRateItems).toContain("RELIEVER_COST");
    expect(patched.estimate.validationSummary.blocksCommercialSubmission).toBe(true);
    expect(patched.estimate.versions[0].overrides.length).toBe(2);

    const subRes = await costingWorkflowRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${postCountEstId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT" }),
      }),
      { params: { id: postCountEstId } }
    );
    expect(subRes.status).toBe(400);
  });

  it("7. Approved snapshots remain immutable and new revisions do NOT inherit prior validation", async () => {
    const legacyEst = await prisma.preContractCostEstimate.create({
      data: {
        caseId: oppId,
        surveyId: unmappedShiftSurveyId,
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
    expect((await getRes.json()).estimate.versions[0].checksum).toBe("legacy-checksum-immutable");

    // Revising an APPROVED estimate creates DRAFT v2 that does NOT inherit prior validation
    const revRes = await patchCostingDetailRoute(
      new Request(`http://localhost:3100/api/v1/commercial/costing/${postCountEstId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createRevision: true, revisionReason: "Post-approval revision", targetMarginPercentage: 18 }),
      }),
      { params: { id: postCountEstId } }
    );
    expect(revRes.status).toBe(200);
    const revData = await revRes.json();
    expect(revData.estimate.currentVersionNumber).toBe(2);
    expect(revData.estimate.validationSummary.isValidated).toBe(false);
    expect(revData.estimate.validationSummary.blocksCommercialSubmission).toBe(true);
  });
});
