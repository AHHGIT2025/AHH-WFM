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

describe("Issue #3 — RELIEVER_COST Calculation, Rate Integrity & Source Provenance", () => {
  const makeRateCard = (ratesJson: Record<string, number>, companyId: string | null = "COMP-002", status = "ACTIVE") => [
    {
      id: "rc-sg-rel",
      code: "SG-QAR-2026",
      currency: "QAR",
      companyId,
      versions: status === "ACTIVE"
        ? [
            {
              id: "rc-ver-rel-1",
              status,
              createdBy: "emp-maker",
              approvedBy: "emp-checker",
              effectiveFrom: new Date("2026-01-01T00:00:00Z"),
              effectiveTo: null,
              ratesJson,
            },
          ]
        : [],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.preContractCase.findUnique as jest.Mock).mockResolvedValue({
      id: "case-opp8",
      companyId: "COMP-002",
      operationType: "SECURITY_GUARDING",
    });
    ((prisma as any).costElementMaster.findMany as jest.Mock).mockResolvedValue([
      { code: "BASIC_PAY", operationType: "SECURITY_GUARDING" },
      { code: "ALLOWANCES", operationType: "SECURITY_GUARDING" },
      { code: "RELIEVER_COST", operationType: "SECURITY_GUARDING" },
    ]);
    (prisma.costConfigurationVersion.findFirst as jest.Mock).mockResolvedValue(null);
  });

  it("1 & 4. RELIEVER_REQUIRED=true + HEADCOUNT=14 + ACTIVE PC-2A RELIEVER_COST uses configured rate and CONFIGURED basis", async () => {
    ((prisma as any).costRateCardMaster.findMany as jest.Mock).mockResolvedValue(
      makeRateCard({ BASIC_PAY: 2400, ALLOWANCES: 900, RELIEVER_COST: 3100 })
    );
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

    const relItem = calc.items.find((i) => i.elementCode === "RELIEVER_COST");
    expect(relItem).toBeDefined();
    expect(relItem!.unitRate && Number(relItem!.unitRate)).toBe(3100);
    expect(relItem!.calculationBasis).toBe("CONFIGURED");
    expect(relItem!.overrideReason).toContain("Qty: 15% baseline formula");
    expect(calc.validationSummary.warnings.some((w) => w.includes("pending Operations approval"))).toBe(true);
    expect(calc.validationSummary.blocksCommercialSubmission).toBe(false);
    expect(calc.validationSummary.validationStatus).toBe("VALIDATED_CONFIGURED");
  });

  it("2. Explicit RELIEVER_REQUIRED=false omits RELIEVER_COST even if COVERAGE_TYPE=24/7", async () => {
    ((prisma as any).costRateCardMaster.findMany as jest.Mock).mockResolvedValue(
      makeRateCard({ BASIC_PAY: 2400, ALLOWANCES: 900 })
    );
    (prisma.preContractSurvey.findUnique as jest.Mock).mockResolvedValue({
      id: "srv-no-rel",
      caseId: "case-opp8",
      responses: [
        { elementCode: "COVERAGE_TYPE", textValue: "24/7" },
        { elementCode: "RELIEVER_REQUIRED", booleanValue: false },
        { elementCode: "HEADCOUNT", numericValue: 14 },
      ],
      siteConditions: [],
      snapshot: null,
    });

    const calc = await calculateCostingEstimate({
      caseId: "case-opp8",
      surveyId: "srv-no-rel",
      effectiveDate: new Date("2026-06-01T00:00:00Z"),
    });

    expect(calc.items.find((i) => i.elementCode === "RELIEVER_COST")).toBeUndefined();
    expect(calc.validationSummary.hasMappedReliefDriver).toBe(true);
    expect(calc.validationSummary.blocksCommercialSubmission).toBe(false);
    expect(calc.validationSummary.warnings.some((w) => w.includes("RELIEVER_REQUIRED=false alongside 24/7 COVERAGE_TYPE"))).toBe(true);
  });

  it("3. Missing RELIEVER_REQUIRED and COVERAGE_TYPE blocks submission", () => {
    const summary = assessCostingValidation(
      [{ elementCode: "HEADCOUNT", numericValue: 14 }],
      {
        status: "DRAFT",
        costConfigVersionId: "rc-ver-rel-1",
        items: [
          { elementCode: "BASIC_PAY", calculationBasis: "CONFIGURED", quantity: 14, unitRate: 2400 },
          { elementCode: "ALLOWANCES", calculationBasis: "CONFIGURED", quantity: 14, unitRate: 900 },
        ],
        overrides: [],
      }
    );
    expect(summary.blocksCommercialSubmission).toBe(true);
    expect(formatCostingValidationBlockError(summary, "submit")).toContain("RELIEVER_REQUIRED or COVERAGE_TYPE");
  });

  it("5 & 7. Missing RELIEVER_COST rate when required marks FALLBACK (never SURVEY_REQUIREMENT) and blocks submission", async () => {
    ((prisma as any).costRateCardMaster.findMany as jest.Mock).mockResolvedValue(
      makeRateCard({ BASIC_PAY: 2400, ALLOWANCES: 900 })
    );
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

    const relItem = calc.items.find((i) => i.elementCode === "RELIEVER_COST");
    expect(relItem).toBeDefined();
    expect(relItem!.calculationBasis).toBe("FALLBACK");
    expect(relItem!.calculationBasis).not.toBe("SURVEY_REQUIREMENT");
    expect(calc.validationSummary.fallbackRateItems).toContain("RELIEVER_COST");
    expect(calc.validationSummary.blocksCommercialSubmission).toBe(true);
    expect(formatCostingValidationBlockError(calc.validationSummary, "submit")).toContain("RELIEVER_COST");
  });

  it("6. Wrong-company or wrong-operation rate card is rejected and blocks submission", async () => {
    ((prisma as any).costRateCardMaster.findMany as jest.Mock).mockResolvedValue(
      makeRateCard({ BASIC_PAY: 2400, ALLOWANCES: 900, RELIEVER_COST: 3100 }, "COMP-OTHER")
    );
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

    expect(calc.validationSummary.blocksCommercialSubmission).toBe(true);
    expect(calc.items.find((i) => i.elementCode === "RELIEVER_COST")?.calculationBasis).toBe("FALLBACK");
  });

  it("7b & 8. Legacy SURVEY_REQUIREMENT reliever basis in stored costing version is treated as unvalidated fallback", () => {
    const legacy = assessCostingValidation(
      [
        { elementCode: "HEADCOUNT", numericValue: 14 },
        { elementCode: "RELIEVER_REQUIRED", booleanValue: true },
        { elementCode: "COVERAGE_TYPE", textValue: "12H_DAY" },
      ],
      {
        status: "DRAFT",
        costConfigVersionId: "rc-ver-rel-1",
        items: [
          { elementCode: "BASIC_PAY", calculationBasis: "CONFIGURED", quantity: 14, unitRate: 2400 },
          { elementCode: "ALLOWANCES", calculationBasis: "CONFIGURED", quantity: 14, unitRate: 900 },
          { elementCode: "RELIEVER_COST", calculationBasis: "SURVEY_REQUIREMENT", quantity: 3, unitRate: 3500 },
        ],
        overrides: [],
      }
    );

    expect(legacy.usesFallbackRates).toBe(true);
    expect(legacy.fallbackRateItems).toContain("RELIEVER_COST");
    expect(legacy.blocksCommercialSubmission).toBe(true);
  });
});
