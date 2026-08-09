import { prisma } from "@ahh-wfm/database";
import crypto from "crypto";
import { Decimal } from "@prisma/client/runtime/library";

export interface CalculateCostingParams {
  caseId: string;
  surveyId: string;
  companyId?: string | null;
  operationType?: string | null;
  effectiveDate?: Date | string;
  pricingBasis?: "MARGIN" | "MARKUP" | "MANUAL";
  targetMarginPercentage?: number | null;
  targetMarkupPercentage?: number | null;
  manualSellingPrice?: number | null;
  overrides?: Array<{
    elementCode: string;
    unitRate?: number;
    quantity?: number;
    reason?: string;
  }>;
}

export interface CalculatedCostingResult {
  currency: string;
  totalDirectCost: Decimal;
  totalIndirectCost: Decimal;
  totalCost: Decimal;
  targetMarginPercentage: Decimal | null;
  targetMarkupPercentage: Decimal | null;
  sellingPrice: Decimal;
  pricingBasis: "MARGIN" | "MARKUP" | "MANUAL";
  costConfigVersionId: string | null;
  items: Array<{
    elementCode: string;
    elementName: string;
    categoryCode: string;
    isDirect: boolean;
    unitOfMeasure?: string | null;
    quantity: Decimal;
    unitRate: Decimal;
    totalAmount: Decimal;
    calculationBasis: string;
    overrideReason?: string | null;
  }>;
}

/**
 * Calculates pre-contract costing estimate deterministically using PC-1 configuration & survey requirements.
 */
export async function calculateCostingEstimate(
  params: CalculateCostingParams
): Promise<CalculatedCostingResult> {
  const {
    caseId,
    surveyId,
    effectiveDate = new Date(),
    pricingBasis = "MARGIN",
    targetMarginPercentage = 15.0,
    targetMarkupPercentage = null,
    manualSellingPrice = null,
    overrides = []
  } = params;

  // Validate Target Gross Margin percentage
  if (pricingBasis === "MARGIN" && targetMarginPercentage !== null && targetMarginPercentage !== undefined) {
    if (targetMarginPercentage >= 100.0) {
      throw new Error("Target Gross Margin percentage must be strictly less than 100%.");
    }
  }

  // 1. Fetch Opportunity Case
  const opCase = await prisma.preContractCase.findUnique({
    where: { id: caseId }
  });
  if (!opCase) {
    throw new Error(`PreContractCase with ID ${caseId} not found.`);
  }

  // 2. Fetch Survey with responses & snapshot
  const survey = await prisma.preContractSurvey.findUnique({
    where: { id: surveyId },
    include: {
      responses: true,
      siteConditions: true,
      snapshot: true
    }
  });
  if (!survey) {
    throw new Error(`PreContractSurvey with ID ${surveyId} not found.`);
  }

  if (survey.caseId !== caseId) {
    throw new Error(`Survey ${surveyId} does not belong to Case ${caseId}.`);
  }

  // 3. Resolve Effective PC-1 Cost Configuration Version
  const activeVersion = await prisma.costConfigurationVersion.findFirst({
    where: {
      status: "ACTIVE",
      effectiveFrom: { lte: new Date(effectiveDate) },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gt: new Date(effectiveDate) } }
      ]
    },
    include: {
      categories: true,
      elements: true,
      rates: true,
      formulas: true,
      driverMappings: true
    },
    orderBy: { effectiveFrom: "desc" }
  });

  const costConfigVersionId = activeVersion?.id || null;

  // 4. Build Cost Line Items
  const items: CalculatedCostingResult["items"] = [];

  // Determine manpower count from survey responses or default baseline
  let totalHeadcount = 1;
  const headcountResponse = survey.responses.find(
    (r) => r.elementCode === "HEADCOUNT" || r.elementCode === "GUARDS_REQUIRED" || r.elementCode === "STAFF_COUNT"
  );
  if (headcountResponse && headcountResponse.numericValue && headcountResponse.numericValue > 0) {
    totalHeadcount = headcountResponse.numericValue;
  }

  // Determine currency from rates or default QAR
  let currency = "QAR";
  if (activeVersion?.rates && activeVersion.rates.length > 0) {
    const rc = activeVersion.rates[0];
    if (rc && rc.currency) {
      currency = rc.currency;
    }
  }

  // Build Manpower Direct Cost Line
  const basicPayElement = activeVersion?.elements?.find(
    (e: any) => e.code === "BASIC_PAY" || (e.name && e.name.toLowerCase().includes("basic"))
  );
  let basicUnitRate = new Decimal(2500); // Baseline monthly rate per headcount
  if (basicPayElement && (basicPayElement as any).baseRate) {
    basicUnitRate = new Decimal((basicPayElement as any).baseRate.toString());
  }

  // Check for override
  const basicOverride = overrides.find((o) => o.elementCode === "BASIC_PAY");
  let basicCalcBasis = "CONFIGURED";
  let basicOverrideReason: string | null = null;
  if (basicOverride && basicOverride.unitRate !== undefined) {
    basicUnitRate = new Decimal(basicOverride.unitRate);
    basicCalcBasis = "OVERRIDE";
    basicOverrideReason = basicOverride.reason || "Manual unit rate override";
  }

  const basicQty = new Decimal(totalHeadcount);
  const basicTotal = basicQty.mul(basicUnitRate);

  items.push({
    elementCode: "BASIC_PAY",
    elementName: "Basic Pay / Manpower Wage",
    categoryCode: "DIRECT_MANPOWER",
    isDirect: true,
    unitOfMeasure: "PERSON_MONTH",
    quantity: basicQty,
    unitRate: basicUnitRate,
    totalAmount: basicTotal,
    calculationBasis: basicCalcBasis,
    overrideReason: basicOverrideReason
  });

  // Build Allowance Direct Cost Line (e.g. Housing, Transport, Food)
  const allowanceQty = new Decimal(totalHeadcount);
  let allowanceUnitRate = new Decimal(1000);
  const allowanceOverride = overrides.find((o) => o.elementCode === "ALLOWANCES");
  let allowanceCalcBasis = "CONFIGURED";
  let allowanceOverrideReason: string | null = null;
  if (allowanceOverride && allowanceOverride.unitRate !== undefined) {
    allowanceUnitRate = new Decimal(allowanceOverride.unitRate);
    allowanceCalcBasis = "OVERRIDE";
    allowanceOverrideReason = allowanceOverride.reason || "Manual allowance override";
  }
  const allowanceTotal = allowanceQty.mul(allowanceUnitRate);

  items.push({
    elementCode: "ALLOWANCES",
    elementName: "Fixed Employment Allowances",
    categoryCode: "DIRECT_MANPOWER",
    isDirect: true,
    unitOfMeasure: "PERSON_MONTH",
    quantity: allowanceQty,
    unitRate: allowanceUnitRate,
    totalAmount: allowanceTotal,
    calculationBasis: allowanceCalcBasis,
    overrideReason: allowanceOverrideReason
  });

  // Check Reliever Cost Line if 24/7 or relief required from survey
  const reliefResponse = survey.responses.find((r) => r.elementCode === "RELIEVER_REQUIRED" || r.elementCode === "COVERAGE_TYPE");
  const requiresRelief = reliefResponse?.booleanValue || reliefResponse?.textValue?.includes("24/7");
  if (requiresRelief) {
    const relieverQty = new Decimal(Math.max(1, Math.ceil(totalHeadcount * 0.15)));
    const relieverUnitRate = basicUnitRate.add(allowanceUnitRate);
    const relieverTotal = relieverQty.mul(relieverUnitRate);
    items.push({
      elementCode: "RELIEVER_COST",
      elementName: "Contractual Reliever Staffing",
      categoryCode: "RELIEVER",
      isDirect: true,
      unitOfMeasure: "PERSON_MONTH",
      quantity: relieverQty,
      unitRate: relieverUnitRate,
      totalAmount: relieverTotal,
      calculationBasis: "SURVEY_REQUIREMENT",
      overrideReason: null
    });
  }

  // Build Indirect Overhead Cost Line
  const directSubtotal = items
    .filter((i) => i.isDirect)
    .reduce((acc, i) => acc.add(i.totalAmount), new Decimal(0));

  const overheadRate = new Decimal(0.10); // 10% overhead allocation
  const overheadTotal = directSubtotal.mul(overheadRate);
  items.push({
    elementCode: "SITE_OVERHEAD",
    elementName: "Site Operations & HR Overhead",
    categoryCode: "INDIRECT_OVERHEAD",
    isDirect: false,
    unitOfMeasure: "PERCENTAGE",
    quantity: new Decimal(1),
    unitRate: overheadTotal,
    totalAmount: overheadTotal,
    calculationBasis: "FORMULA",
    overrideReason: null
  });

  // Calculate Totals using Decimal
  const totalDirectCost = items
    .filter((i) => i.isDirect)
    .reduce((acc, i) => acc.add(i.totalAmount), new Decimal(0));

  const totalIndirectCost = items
    .filter((i) => !i.isDirect)
    .reduce((acc, i) => acc.add(i.totalAmount), new Decimal(0));

  const totalCost = totalDirectCost.add(totalIndirectCost);

  // 5. Pricing Basis Calculation (Selling Price & Margins)
  let sellingPrice = new Decimal(0);
  let finalTargetMargin: Decimal | null = null;
  let finalTargetMarkup: Decimal | null = null;

  if (pricingBasis === "MARGIN") {
    const targetMargin = targetMarginPercentage !== null && targetMarginPercentage !== undefined
      ? targetMarginPercentage
      : 15.0;

    finalTargetMargin = new Decimal(targetMargin.toFixed(2));
    // Selling Price = Total Cost / (1 - Margin/100)
    const marginFactor = new Decimal(1).sub(finalTargetMargin.div(100));
    sellingPrice = totalCost.gt(0) ? totalCost.div(marginFactor) : new Decimal(0);

    // Derived Markup % = (Selling Price - Total Cost) / Total Cost * 100
    if (totalCost.gt(0)) {
      finalTargetMarkup = sellingPrice.sub(totalCost).div(totalCost).mul(100);
    }
  } else if (pricingBasis === "MARKUP") {
    const targetMarkup = targetMarkupPercentage !== null && targetMarkupPercentage !== undefined
      ? targetMarkupPercentage
      : 20.0;

    finalTargetMarkup = new Decimal(targetMarkup.toFixed(2));
    // Selling Price = Total Cost * (1 + Markup/100)
    const markupFactor = new Decimal(1).add(finalTargetMarkup.div(100));
    sellingPrice = totalCost.mul(markupFactor);

    // Derived Gross Margin % = (Selling Price - Total Cost) / Selling Price * 100
    if (sellingPrice.gt(0)) {
      finalTargetMargin = sellingPrice.sub(totalCost).div(sellingPrice).mul(100);
    }
  } else {
    // MANUAL SELLING PRICE
    if (manualSellingPrice === null || manualSellingPrice === undefined || manualSellingPrice < 0) {
      throw new Error("Manual selling price must be provided and non-negative.");
    }
    sellingPrice = new Decimal(manualSellingPrice.toFixed(2));

    if (sellingPrice.gt(0)) {
      finalTargetMargin = sellingPrice.sub(totalCost).div(sellingPrice).mul(100);
    }
    if (totalCost.gt(0)) {
      finalTargetMarkup = sellingPrice.sub(totalCost).div(totalCost).mul(100);
    }
  }

  // Round all totals to 2 decimal places using Decimal.toFixed(2)
  return {
    currency,
    totalDirectCost: new Decimal(totalDirectCost.toFixed(2)),
    totalIndirectCost: new Decimal(totalIndirectCost.toFixed(2)),
    totalCost: new Decimal(totalCost.toFixed(2)),
    targetMarginPercentage: finalTargetMargin ? new Decimal(finalTargetMargin.toFixed(2)) : null,
    targetMarkupPercentage: finalTargetMarkup ? new Decimal(finalTargetMarkup.toFixed(2)) : null,
    sellingPrice: new Decimal(sellingPrice.toFixed(2)),
    pricingBasis,
    costConfigVersionId,
    items: items.map((i) => ({
      ...i,
      quantity: new Decimal(i.quantity.toFixed(4)),
      unitRate: new Decimal(i.unitRate.toFixed(2)),
      totalAmount: new Decimal(i.totalAmount.toFixed(2))
    }))
  };
}

/**
 * Constructs deterministic JSON snapshot and SHA-256 checksum for approved costing estimate version.
 */
export function generateCostingSnapshot(
  estimate: {
    id: string;
    caseId: string;
    surveyId: string;
    companyId?: string | null;
    operationType?: string | null;
  },
  version: {
    id: string;
    versionNumber: number;
    pricingBasis: string;
    currency: string;
    totalDirectCost: Decimal | number;
    totalIndirectCost: Decimal | number;
    totalCost: Decimal | number;
    targetMarginPercentage?: Decimal | number | null;
    targetMarkupPercentage?: Decimal | number | null;
    sellingPrice: Decimal | number;
  },
  items: Array<{
    elementCode: string;
    elementName: string;
    categoryCode: string;
    isDirect: boolean;
    quantity: Decimal | number;
    unitRate: Decimal | number;
    totalAmount: Decimal | number;
    calculationBasis: string;
  }>,
  timestamp: Date | string = "2026-08-09T12:00:00.000Z"
) {
  const snapshotData = {
    estimateId: estimate.id,
    caseId: estimate.caseId,
    surveyId: estimate.surveyId,
    companyId: estimate.companyId || null,
    operationType: estimate.operationType || null,
    versionNumber: version.versionNumber,
    pricingBasis: version.pricingBasis,
    currency: version.currency,
    totals: {
      totalDirectCost: Number(version.totalDirectCost),
      totalIndirectCost: Number(version.totalIndirectCost),
      totalCost: Number(version.totalCost),
      targetMarginPercentage: version.targetMarginPercentage ? Number(version.targetMarginPercentage) : null,
      targetMarkupPercentage: version.targetMarkupPercentage ? Number(version.targetMarkupPercentage) : null,
      sellingPrice: Number(version.sellingPrice)
    },
    items: items.map((i) => ({
      elementCode: i.elementCode,
      elementName: i.elementName,
      categoryCode: i.categoryCode,
      isDirect: i.isDirect,
      quantity: Number(i.quantity),
      unitRate: Number(i.unitRate),
      totalAmount: Number(i.totalAmount),
      calculationBasis: i.calculationBasis
    })),
    createdAt: typeof timestamp === "string" ? timestamp : timestamp.toISOString()
  };

  const snapshotJson = JSON.stringify(snapshotData, Object.keys(snapshotData).sort(), 2);
  const checksum = crypto.createHash("sha256").update(snapshotJson).digest("hex");

  return { snapshotJson, checksum };
}
