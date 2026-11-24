import {
  assessCostingValidation,
  calculateCostingEstimate,
  formatCostingValidationBlockError,
} from "../../apps/web/lib/precontract-costing";
import { prisma } from "@ahh-wfm/database";

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
    },
  };
});

describe("Issue #2 — DEF-104 Headcount Validation Contradiction (Scenarios A–F)", () => {
  const activeRateCard = [
    {
      id: "rc-sg",
      code: "SG-QAR-2026",
      currency: "QAR",
      companyId: "COMP-002",
      versions: [
        {
          id: "rc-ver-1",
          status: "ACTIVE",
          createdBy: "emp-maker",
          approvedBy: "emp-checker",
          effectiveFrom: new Date("2026-01-01T00:00:00Z"),
          effectiveTo: null,
          ratesJson: { BASIC_PAY: 2400, ALLOWANCES: 900, RELIEVER_COST: 3300 },
        },
      ],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.preContractCase.findUnique as jest.Mock).mockResolvedValue({
      id: "case-opp8",
      companyId: "COMP-002",
      operationType: "SECURITY_GUARDING",
    });
    ((prisma as any).costRateCardMaster.findMany as jest.Mock).mockResolvedValue(activeRateCard);
    ((prisma as any).costElementMaster.findMany as jest.Mock).mockResolvedValue([
      { code: "BASIC_PAY", operationType: "SECURITY_GUARDING" },
      { code: "ALLOWANCES", operationType: "SECURITY_GUARDING" },
    ]);
    (prisma.costConfigurationVersion.findFirst as jest.Mock).mockResolvedValue(null);
  });

  it("Scenario A & D: Valid staffing (HEADCOUNT=14, RELIEVER_REQUIRED=true, COVERAGE_TYPE=12H_DAY, blank ELEM_POST_COUNT) + ACTIVE PC-2A passes without false assumed-headcount error", async () => {
    (prisma.preContractSurvey.findUnique as jest.Mock).mockResolvedValue({
      id: "srv-opp8",
      caseId: "case-opp8",
      responses: [
        { elementCode: "HEADCOUNT", numericValue: 14 },
        { elementCode: "RELIEVER_REQUIRED", booleanValue: true },
        { elementCode: "COVERAGE_TYPE", textValue: "12H_DAY" },
      ],
      siteConditions: [],
      snapshot: null,
    });

    const calc = await calculateCostingEstimate({
      caseId: "case-opp8",
      surveyId: "srv-opp8",
      effectiveDate: new Date("2026-06-01T00:00:00Z"),
    });

    expect(Number(calc.items.find((i) => i.elementCode === "BASIC_PAY")?.quantity)).toBe(14);
    expect(Number(calc.items.find((i) => i.elementCode === "ALLOWANCES")?.quantity)).toBe(14);
    expect(Number(calc.items.find((i) => i.elementCode === "RELIEVER_COST")?.quantity)).toBe(3);
    expect(calc.validationSummary.hasMappedSurveyHeadcount).toBe(true);
    expect(calc.validationSummary.hasMappedReliefDriver).toBe(true);
    expect(calc.validationSummary.assumedFallbackHeadcount).toBe(false);
    expect(calc.validationSummary.unmappedSurveyManpowerFields).toEqual([]);
    expect(calc.validationSummary.blocksCommercialSubmission).toBe(false);
    expect(calc.validationSummary.validationStatus).toBe("VALIDATED_CONFIGURED");
  });

  it("Scenario B: Missing HEADCOUNT blocks submission with field-specific error (no empty parens)", async () => {
    const summary = assessCostingValidation(
      [
        { elementCode: "RELIEVER_REQUIRED", booleanValue: true },
        { elementCode: "COVERAGE_TYPE", textValue: "12H_DAY" },
      ],
      {
        status: "DRAFT",
        costConfigVersionId: "rc-ver-1",
        items: [
          { elementCode: "BASIC_PAY", calculationBasis: "FALLBACK", quantity: 1, unitRate: 2400 },
          { elementCode: "ALLOWANCES", calculationBasis: "FALLBACK", quantity: 1, unitRate: 900 },
        ],
        overrides: [],
      }
    );

    expect(summary.hasMappedSurveyHeadcount).toBe(false);
    expect(summary.blocksCommercialSubmission).toBe(true);
    expect(summary.missingMandatoryFields).toContain("HEADCOUNT");
    const msg = formatCostingValidationBlockError(summary, "submit");
    expect(msg).toContain("HEADCOUNT");
    expect(msg).not.toContain("()");
  });

  it("Scenario C: Missing RELIEVER_REQUIRED and COVERAGE_TYPE blocks submission with no silent defaults; explicit false is accepted", () => {
    const missingRelief = assessCostingValidation(
      [{ elementCode: "HEADCOUNT", numericValue: 14 }],
      {
        status: "DRAFT",
        costConfigVersionId: "rc-ver-1",
        items: [
          { elementCode: "BASIC_PAY", calculationBasis: "CONFIGURED", quantity: 14, unitRate: 2400 },
          { elementCode: "ALLOWANCES", calculationBasis: "CONFIGURED", quantity: 14, unitRate: 900 },
        ],
        overrides: [],
      }
    );
    expect(missingRelief.hasMappedReliefDriver).toBe(false);
    expect(missingRelief.blocksCommercialSubmission).toBe(true);
    const msg = formatCostingValidationBlockError(missingRelief, "submit");
    expect(msg).toContain("RELIEVER_REQUIRED or COVERAGE_TYPE");
    expect(msg).not.toContain("assumed headcount = 1");
    expect(msg).not.toContain("()");

    const explicitNoRelief = assessCostingValidation(
      [
        { elementCode: "HEADCOUNT", numericValue: 14 },
        { elementCode: "RELIEVER_REQUIRED", booleanValue: false },
      ],
      {
        status: "DRAFT",
        costConfigVersionId: "rc-ver-1",
        items: [
          { elementCode: "BASIC_PAY", calculationBasis: "CONFIGURED", quantity: 14, unitRate: 2400 },
          { elementCode: "ALLOWANCES", calculationBasis: "CONFIGURED", quantity: 14, unitRate: 900 },
        ],
        overrides: [],
      }
    );
    expect(explicitNoRelief.hasMappedReliefDriver).toBe(true);
    expect(explicitNoRelief.blocksCommercialSubmission).toBe(false);
  });

  it("Scenario E: No ACTIVE PC-2A Rate Card blocks submission with rate-card error (never contradictory assumed headcount = 1)", async () => {
    ((prisma as any).costRateCardMaster.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.preContractSurvey.findUnique as jest.Mock).mockResolvedValue({
      id: "srv-opp8",
      caseId: "case-opp8",
      responses: [
        { elementCode: "HEADCOUNT", numericValue: 14 },
        { elementCode: "RELIEVER_REQUIRED", booleanValue: true },
        { elementCode: "COVERAGE_TYPE", textValue: "12H_DAY" },
      ],
      siteConditions: [],
      snapshot: null,
    });

    const calc = await calculateCostingEstimate({
      caseId: "case-opp8",
      surveyId: "srv-opp8",
      effectiveDate: new Date("2026-06-01T00:00:00Z"),
    });

    expect(calc.validationSummary.hasMappedSurveyHeadcount).toBe(true);
    expect(calc.validationSummary.assumedFallbackHeadcount).toBe(false);
    expect(calc.validationSummary.blocksCommercialSubmission).toBe(true);
    const msg = formatCostingValidationBlockError(calc.validationSummary, "submit");
    expect(msg).toContain("ACTIVE PC-2A Rate Card");
    expect(msg).not.toContain("assumed headcount = 1");
    expect(msg).not.toContain("()");
  });

  it("Scenario F: Legacy survey with unmapped ELEM_POST_COUNT only remains blocked and identifies ELEM_POST_COUNT", () => {
    const legacy = assessCostingValidation(
      [{ elementCode: "ELEM_POST_COUNT", numericValue: 6 }],
      {
        status: "DRAFT",
        costConfigVersionId: "rc-ver-1",
        items: [
          { elementCode: "BASIC_PAY", calculationBasis: "FALLBACK", quantity: 1, unitRate: 2400 },
          { elementCode: "ALLOWANCES", calculationBasis: "FALLBACK", quantity: 1, unitRate: 900 },
        ],
        overrides: [],
      }
    );
    expect(legacy.blocksCommercialSubmission).toBe(true);
    expect(legacy.unmappedSurveyManpowerFields).toEqual(["ELEM_POST_COUNT"]);
    const msg = formatCostingValidationBlockError(legacy, "submit");
    expect(msg).toContain("ELEM_POST_COUNT");
    expect(msg).toContain("assumed headcount = 1");
  });
});
