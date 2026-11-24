import { Prisma, prisma } from "@ahh-wfm/database";
import { getServerSession } from "next-auth/next";
import { NextRequest } from "next/server";
import { PATCH as patchCostingDetailRoute } from "../../apps/web/app/api/v1/commercial/costing/[id]/route";
import { POST as costingWorkflowRoute } from "../../apps/web/app/api/v1/commercial/costing/[id]/workflow/route";
import { POST as issueProposalRoute } from "../../apps/web/app/api/v1/commercial/proposals/[id]/issue/route";
import { assessCostingValidation, calculateCostingEstimate } from "../../apps/web/lib/precontract-costing";
import { DEFAULT_ROLE_PERMISSIONS } from "../../apps/web/lib/permissions";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@ahh-wfm/database", () => {
  const actual = jest.requireActual("@ahh-wfm/database");
  return {
    ...actual,
    prisma: {
      preContractCase: { findUnique: jest.fn() },
      preContractSurvey: { findUnique: jest.fn() },
      costRateCardMaster: { findMany: jest.fn() },
      costElementMaster: { findMany: jest.fn() },
      costConfigurationVersion: { findFirst: jest.fn() },
      preContractCostEstimate: { findUnique: jest.fn(), update: jest.fn() },
      preContractCostEstimateItem: { deleteMany: jest.fn() },
      preContractCostEstimateVersion: { update: jest.fn() },
      preContractCostOverrideLog: { createMany: jest.fn() },
      preContractProposal: { findUnique: jest.fn() },
    },
  };
});

describe("OPP6 PC-2A Costing Integration & Survey Staffing Readiness (Isolated Suite)", () => {
  const validSurvey = {
    id: "srv-valid",
    caseId: "case-opp6",
    responses: [
      { elementCode: "HEADCOUNT", numericValue: 18 },
      { elementCode: "RELIEVER_REQUIRED", booleanValue: true },
      { elementCode: "ELEM_POST_COUNT", numericValue: 6 },
      { elementCode: "ELEM_SHIFT_PATTERN", textValue: "24/7" },
    ],
    siteConditions: [],
    snapshot: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.preContractCase.findUnique as jest.Mock).mockResolvedValue({
      id: "case-opp6",
      companyId: "COMP-002",
      operationType: "SECURITY_GUARDING",
    });
    ((prisma as any).costRateCardMaster.findMany as jest.Mock).mockResolvedValue([]);
    ((prisma as any).costElementMaster.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.costConfigurationVersion.findFirst as jest.Mock).mockResolvedValue(null);
  });

  it("1 & 6. Approved ACTIVE PC-2A rates + valid survey staffing yield VALIDATED_CONFIGURED and take precedence over legacy config", async () => {
    (prisma.preContractSurvey.findUnique as jest.Mock).mockResolvedValue(validSurvey);
    ((prisma as any).costRateCardMaster.findMany as jest.Mock).mockResolvedValue([
      {
        id: "rc-master-sg",
        code: "SG-QAR-2026",
        currency: "QAR",
        companyId: "COMP-002",
        versions: [
          {
            id: "rc-ver-active-1",
            status: "ACTIVE",
            createdBy: "emp-maker",
            approvedBy: "emp-checker",
            effectiveFrom: new Date("2026-01-01T00:00:00Z"),
            effectiveTo: null,
            ratesJson: { BASIC_PAY: 2400, ALLOWANCES: 900, RELIEVER_COST: 3300 },
          },
        ],
      },
    ]);
    ((prisma as any).costElementMaster.findMany as jest.Mock).mockResolvedValue([
      { code: "BASIC_PAY", operationType: "SECURITY_GUARDING" },
      { code: "ALLOWANCES", operationType: "SECURITY_GUARDING" },
    ]);
    // Legacy config should NOT override PC-2A
    (prisma.costConfigurationVersion.findFirst as jest.Mock).mockResolvedValue({
      id: "legacy-should-be-ignored",
      rates: [{ elementCode: "BASIC_PAY", rateValue: 9999, currency: "USD" }],
    });

    const calc = await calculateCostingEstimate({
      caseId: "case-opp6",
      surveyId: "srv-valid",
      effectiveDate: new Date("2026-06-01T00:00:00Z"),
    });

    expect(calc.costConfigVersionId).toBe("rc-ver-active-1");
    expect(calc.currency).toBe("QAR");
    expect(calc.validationSummary.validationStatus).toBe("VALIDATED_CONFIGURED");
    expect(calc.validationSummary.isValidated).toBe(true);
    expect(calc.validationSummary.blocksCommercialSubmission).toBe(false);
    expect(Number(calc.items.find((i) => i.elementCode === "BASIC_PAY")?.unitRate)).toBe(2400);
    expect(Number(calc.items.find((i) => i.elementCode === "ALLOWANCES")?.unitRate)).toBe(900);
    expect(calc.items.find((i) => i.elementCode === "BASIC_PAY")?.calculationBasis).toBe("CONFIGURED");
    expect(calc.items.find((i) => i.elementCode === "ALLOWANCES")?.calculationBasis).toBe("CONFIGURED");
    expect(calc.totalDirectCost).toEqual(new Prisma.Decimal("69300.00"));
  });

  it("2 & 8. No ACTIVE version blocks costing submission & proposal issuance even with survey headcount", async () => {
    (prisma.preContractSurvey.findUnique as jest.Mock).mockResolvedValue(validSurvey);
    const calc = await calculateCostingEstimate({ caseId: "case-opp6", surveyId: "srv-valid" });

    expect(calc.costConfigVersionId).toBeNull();
    expect(calc.validationSummary.hasActiveCostConfig).toBe(false);
    expect(calc.validationSummary.blocksCommercialSubmission).toBe(true);

    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        id: "emp-shana",
        role: "COMMERCIAL_MAKER",
        companyId: "COMP-002",
        operationAccess: { allowedSecurityGuarding: true },
        permissions: [...DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_MAKER, "precontract.workflow.submit", "precontract.proposal.issue"],
      },
    });
    (prisma.preContractCostEstimate.findUnique as jest.Mock).mockResolvedValue({
      id: "est-no-cfg",
      caseId: "case-opp6",
      surveyId: "srv-valid",
      companyId: "COMP-002",
      operationType: "SECURITY_GUARDING",
      status: "DRAFT",
      survey: validSurvey,
      versions: [{ id: "ver-1", status: "DRAFT", costConfigVersionId: null, items: calc.items, overrides: [] }],
    });

    const subRes = await costingWorkflowRoute(
      new Request("http://localhost:3100/api/v1/commercial/costing/est-no-cfg/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT" }),
      }),
      { params: { id: "est-no-cfg" } }
    );
    expect(subRes.status).toBe(400);

    (prisma.preContractProposal.findUnique as jest.Mock).mockResolvedValue({
      id: "prop-1",
      versions: [
        {
          id: "pv-1",
          versionNumber: 1,
          status: "APPROVED_INTERNAL",
          costEstimate: { survey: validSurvey },
          costEstimateVersion: { id: "ver-1", status: "APPROVED", costConfigVersionId: null, items: calc.items, overrides: [] },
        },
      ],
    });
    const issueRes = await issueProposalRoute(
      new NextRequest("http://localhost:3100/api/v1/commercial/proposals/prop-1/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientName: "Client" }),
      }),
      { params: { id: "prop-1" } }
    );
    expect(issueRes.status).toBe(400);
  });

  it("3 & 4. Unapproved (self-approved/null), expired, wrong-company, and wrong-operation PC-2A rates are rejected", async () => {
    (prisma.preContractSurvey.findUnique as jest.Mock).mockResolvedValue(validSurvey);
    ((prisma as any).costRateCardMaster.findMany as jest.Mock).mockResolvedValue([
      {
        id: "rc-bad",
        currency: "QAR",
        companyId: "COMP-OTHER", // wrong company
        versions: [
          {
            id: "ver-wrong-co",
            status: "ACTIVE",
            createdBy: "u1",
            approvedBy: "u2",
            effectiveFrom: new Date("2026-01-01T00:00:00Z"),
            effectiveTo: null,
            ratesJson: { BASIC_PAY: 2000, ALLOWANCES: 500 },
          },
        ],
      },
      {
        id: "rc-self-expired",
        currency: "QAR",
        companyId: "COMP-002",
        versions: [
          {
            id: "ver-self",
            status: "ACTIVE",
            createdBy: "u1",
            approvedBy: "u1", // self-approved invalid
            effectiveFrom: new Date("2026-01-01T00:00:00Z"),
            effectiveTo: null,
            ratesJson: { BASIC_PAY: 2000, ALLOWANCES: 500 },
          },
          {
            id: "ver-expired",
            status: "ACTIVE",
            createdBy: "u1",
            approvedBy: "u2",
            effectiveFrom: new Date("2025-01-01T00:00:00Z"),
            effectiveTo: new Date("2026-01-01T00:00:00Z"), // expired before 2026-06-01
            ratesJson: { BASIC_PAY: 2000, ALLOWANCES: 500 },
          },
        ],
      },
    ]);

    const calc = await calculateCostingEstimate({
      caseId: "case-opp6",
      surveyId: "srv-valid",
      effectiveDate: new Date("2026-06-01T00:00:00Z"),
    });
    expect(calc.costConfigVersionId).toBeNull();
    expect(calc.validationSummary.blocksCommercialSubmission).toBe(true);

    // Wrong operationType on CostElementMaster also rejects PC-2A resolution
    ((prisma as any).costRateCardMaster.findMany as jest.Mock).mockResolvedValue([
      {
        id: "rc-ok",
        currency: "QAR",
        companyId: "COMP-002",
        versions: [
          {
            id: "ver-ok",
            status: "ACTIVE",
            createdBy: "u1",
            approvedBy: "u2",
            effectiveFrom: new Date("2026-01-01T00:00:00Z"),
            effectiveTo: null,
            ratesJson: { BASIC_PAY: 2400, ALLOWANCES: 900, RELIEVER_COST: 3300 },
          },
        ],
      },
    ]);
    ((prisma as any).costElementMaster.findMany as jest.Mock).mockResolvedValue([
      { code: "BASIC_PAY", operationType: "FACILITY_MANAGEMENT" }, // wrong operationType
    ]);
    const wrongOpCalc = await calculateCostingEstimate({
      caseId: "case-opp6",
      surveyId: "srv-valid",
      effectiveDate: new Date("2026-06-01T00:00:00Z"),
    });
    expect(wrongOpCalc.costConfigVersionId).toBeNull();
    expect(wrongOpCalc.validationSummary.blocksCommercialSubmission).toBe(true);
  });

  it("5 & 7. Missing survey headcount/relief blocks submission; unauthorized override returns 403", async () => {
    const missingSummary = assessCostingValidation(
      [{ elementCode: "ELEM_POST_COUNT", numericValue: 6 }],
      {
        status: "DRAFT",
        costConfigVersionId: "rc-ver-active-1",
        items: [
          { elementCode: "BASIC_PAY", calculationBasis: "FALLBACK", quantity: 1, unitRate: 2400 },
          { elementCode: "ALLOWANCES", calculationBasis: "FALLBACK", quantity: 1, unitRate: 900 },
        ],
        overrides: [],
      }
    );
    expect(missingSummary.blocksCommercialSubmission).toBe(true);

    (prisma.preContractCostEstimate.findUnique as jest.Mock).mockResolvedValue({
      id: "est-opp6",
      caseId: "case-opp6",
      surveyId: "srv-valid",
      companyId: "COMP-002",
      operationType: "SECURITY_GUARDING",
      currentVersionNumber: 1,
      versions: [{ id: "ver-1", status: "DRAFT", pricingBasis: "MARGIN", targetMarginPercentage: 15, items: [], overrides: [] }],
    });
    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        id: "emp-maker",
        role: "COMMERCIAL_MAKER",
        companyId: "COMP-002",
        permissions: DEFAULT_ROLE_PERMISSIONS.COMMERCIAL_MAKER,
      },
    });

    const deniedRes = await patchCostingDetailRoute(
      new Request("http://localhost:3100/api/v1/commercial/costing/est-opp6", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides: [{ elementCode: "BASIC_PAY", quantity: 6, unitRate: 2600, reason: "Unauthorized" }] }),
      }),
      { params: { id: "est-opp6" } }
    );
    expect(deniedRes.status).toBe(403);
  });
});
