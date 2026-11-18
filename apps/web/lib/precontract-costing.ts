import { prisma, Prisma } from "@ahh-wfm/database";
import crypto from "crypto";

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

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

export interface CostingValidationSummary {
  validationStatus:
    | "VALIDATED_CONFIGURED"
    | "VALIDATED_BY_OVERRIDE"
    | "UNVALIDATED_LEGACY_APPROVED"
    | "UNVALIDATED_FALLBACK";
  isValidated: boolean;
  requiresValidation: boolean;
  blocksCommercialSubmission: boolean;
  hasMappedSurveyHeadcount: boolean;
  assumedFallbackHeadcount: boolean;
  unmappedSurveyManpowerFields: string[];
  hasActiveCostConfig: boolean;
  usesFallbackRates: boolean;
  fallbackRateItems: string[];
  overrideAuditCount: number;
  warnings: string[];
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
  validationSummary: CostingValidationSummary;
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

const MAPPED_HEADCOUNT_CODES = new Set(["HEADCOUNT", "GUARDS_REQUIRED", "STAFF_COUNT"]);
const UNMAPPED_MANPOWER_SURVEY_CODES = new Set(["ELEM_POST_COUNT", "ELEM_SHIFT_PATTERN"]);

/**
 * Evaluates whether a costing version relies on unmapped survey manpower fields,
 * assumed fallback headcount, or hardcoded fallback rates, and whether an
 * authorized estimator override audit exists.
 */
export function assessCostingValidation(
  surveyResponses?: Array<{
    elementCode: string;
    numericValue?: any;
    textValue?: string | null;
    booleanValue?: boolean | null;
  }> | null,
  version?: {
    status?: string | null;
    costConfigVersionId?: string | null;
    items?: Array<{
      elementCode: string;
      quantity?: any;
      unitRate?: any;
      calculationBasis?: string | null;
    }> | null;
    overrides?: Array<{
      fieldPath: string;
      overriddenBy?: string | null;
      reason?: string | null;
    }> | null;
  } | null
): CostingValidationSummary {
  const responses = Array.isArray(surveyResponses) ? surveyResponses : [];
  const items = Array.isArray(version?.items) ? version!.items! : [];
  const overrides = Array.isArray(version?.overrides) ? version!.overrides! : [];

  const mappedHeadcountResponse = responses.find(
    (r) =>
      MAPPED_HEADCOUNT_CODES.has(r.elementCode) &&
      r.numericValue !== null &&
      r.numericValue !== undefined &&
      Number(r.numericValue) > 0
  );
  const hasMappedSurveyHeadcount = Boolean(mappedHeadcountResponse);

  const unmappedSurveyManpowerFields = !hasMappedSurveyHeadcount
    ? responses
        .filter((r) => {
          if (!UNMAPPED_MANPOWER_SURVEY_CODES.has(r.elementCode)) return false;
          const hasNum = r.numericValue !== null && r.numericValue !== undefined && Number(r.numericValue) > 0;
          const hasText = typeof r.textValue === "string" && r.textValue.trim().length > 0;
          return hasNum || hasText;
        })
        .map((r) => r.elementCode)
    : [];

  const hasBasicPayOverride =
    overrides.some((o) => o.fieldPath === "items[BASIC_PAY]") ||
    items.some((i) => i.elementCode === "BASIC_PAY" && i.calculationBasis === "OVERRIDE");
  const hasAllowanceOverride =
    overrides.some((o) => o.fieldPath === "items[ALLOWANCES]") ||
    items.some((i) => i.elementCode === "ALLOWANCES" && i.calculationBasis === "OVERRIDE");

  const assumedFallbackHeadcount = !hasMappedSurveyHeadcount && !hasBasicPayOverride;
  const hasActiveCostConfig = Boolean(version?.costConfigVersionId);

  const fallbackRateItems: string[] = [];
  const basicItem = items.find((i) => i.elementCode === "BASIC_PAY");
  const allowanceItem = items.find((i) => i.elementCode === "ALLOWANCES");

  if (
    basicItem &&
    basicItem.calculationBasis !== "OVERRIDE" &&
    (basicItem.calculationBasis === "FALLBACK" || !hasActiveCostConfig)
  ) {
    fallbackRateItems.push("BASIC_PAY");
  }
  if (
    allowanceItem &&
    allowanceItem.calculationBasis !== "OVERRIDE" &&
    (allowanceItem.calculationBasis === "FALLBACK" || Number(allowanceItem.unitRate) === 1000)
  ) {
    fallbackRateItems.push("ALLOWANCES");
  }

  const usesFallbackRates = fallbackRateItems.length > 0;
  const hasAllFallbacksOverridden =
    (!assumedFallbackHeadcount || hasBasicPayOverride) &&
    (!fallbackRateItems.includes("BASIC_PAY") || hasBasicPayOverride) &&
    (!fallbackRateItems.includes("ALLOWANCES") || hasAllowanceOverride);

  const warnings: string[] = [];
  if (unmappedSurveyManpowerFields.length > 0 && !hasBasicPayOverride) {
    warnings.push(
      `Survey captured unmapped manpower/shift fields (${unmappedSurveyManpowerFields.join(", ")}); costing defaulted to assumed headcount = 1.`
    );
  } else if (assumedFallbackHeadcount) {
    warnings.push(
      "Survey lacks mapped headcount drivers (HEADCOUNT / GUARDS_REQUIRED / STAFF_COUNT); costing defaulted to assumed headcount = 1."
    );
  }
  if (!hasActiveCostConfig) {
    warnings.push("No ACTIVE Cost Configuration Version was linked; hardcoded fallback baseline rates may apply.");
  }
  if (usesFallbackRates) {
    warnings.push(
      `Hardcoded fallback unit rates are active on: ${fallbackRateItems.join(", ")}.`
    );
  }

  let validationStatus: CostingValidationSummary["validationStatus"] = "UNVALIDATED_FALLBACK";
  if (hasMappedSurveyHeadcount && hasActiveCostConfig && !usesFallbackRates) {
    validationStatus = "VALIDATED_CONFIGURED";
  } else if (overrides.length > 0 && hasAllFallbacksOverridden) {
    validationStatus = "VALIDATED_BY_OVERRIDE";
  } else if (version?.status === "APPROVED") {
    validationStatus = "UNVALIDATED_LEGACY_APPROVED";
  }

  const isValidated =
    validationStatus === "VALIDATED_CONFIGURED" || validationStatus === "VALIDATED_BY_OVERRIDE";
  const blocksCommercialSubmission = unmappedSurveyManpowerFields.length > 0 && !hasBasicPayOverride;

  return {
    validationStatus,
    isValidated,
    requiresValidation: !isValidated,
    blocksCommercialSubmission,
    hasMappedSurveyHeadcount,
    assumedFallbackHeadcount,
    unmappedSurveyManpowerFields,
    hasActiveCostConfig,
    usesFallbackRates,
    fallbackRateItems,
    overrideAuditCount: overrides.length,
    warnings,
  };
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
  const hasConfiguredBasicRate = Boolean(basicPayElement && (basicPayElement as any).baseRate);
  let basicUnitRate = new Decimal(2500); // Baseline monthly rate per headcount
  if (hasConfiguredBasicRate) {
    basicUnitRate = new Decimal((basicPayElement as any).baseRate.toString());
  }

  // Check for override
  const basicOverride = overrides.find((o) => o.elementCode === "BASIC_PAY");
  const hasMappedHeadcount = Boolean(
    headcountResponse && headcountResponse.numericValue && headcountResponse.numericValue > 0
  );
  let basicHeadcount = totalHeadcount;
  let basicCalcBasis =
    hasMappedHeadcount && hasConfiguredBasicRate ? "CONFIGURED" : "FALLBACK";
  let basicOverrideReason: string | null = null;
  if (basicOverride && (basicOverride.unitRate !== undefined || basicOverride.quantity !== undefined)) {
    if (basicOverride.unitRate !== undefined) {
      basicUnitRate = new Decimal(basicOverride.unitRate);
    }
    if (basicOverride.quantity !== undefined && basicOverride.quantity > 0) {
      basicHeadcount = basicOverride.quantity;
    }
    basicCalcBasis = "OVERRIDE";
    basicOverrideReason = basicOverride.reason || "Manual line override";
  }

  const basicQty = new Decimal(basicHeadcount);
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
  let allowanceHeadcount = basicHeadcount;
  let allowanceUnitRate = new Decimal(1000);
  const allowanceOverride = overrides.find((o) => o.elementCode === "ALLOWANCES");
  let allowanceCalcBasis = "FALLBACK";
  let allowanceOverrideReason: string | null = null;
  if (allowanceOverride && (allowanceOverride.unitRate !== undefined || allowanceOverride.quantity !== undefined)) {
    if (allowanceOverride.unitRate !== undefined) {
      allowanceUnitRate = new Decimal(allowanceOverride.unitRate);
    }
    if (allowanceOverride.quantity !== undefined && allowanceOverride.quantity > 0) {
      allowanceHeadcount = allowanceOverride.quantity;
    }
    allowanceCalcBasis = "OVERRIDE";
    allowanceOverrideReason = allowanceOverride.reason || "Manual allowance override";
  }
  const allowanceQty = new Decimal(allowanceHeadcount);
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

  const validationSummary = assessCostingValidation(survey.responses, {
    status: "DRAFT",
    costConfigVersionId,
    items: items.map((i) => ({
      elementCode: i.elementCode,
      quantity: i.quantity,
      unitRate: i.unitRate,
      calculationBasis: i.calculationBasis
    })),
    overrides: overrides.map((o) => ({
      fieldPath: `items[${o.elementCode}]`,
      reason: o.reason
    }))
  });

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
    validationSummary,
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

/**
 * Safely converts a Prisma Decimal, numeric string, or number into a finite JavaScript number.
 */
export function toSafeCostingNumber(value: unknown, fallback: number = 0): number {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === "object" && value !== null && "toNumber" in value && typeof (value as any).toNumber === "function") {
    const converted = (value as any).toNumber();
    return Number.isFinite(converted) ? converted : fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Normalizes a nullable Prisma Decimal / string / number into `number | null`.
 */
export function toSafeNullableCostingNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return toSafeCostingNumber(value, 0);
}

/**
 * Formats a numeric/Decimal/string percentage value safely to fixed decimal places.
 */
export function formatMarginPercentage(value: unknown, decimals: number = 2): string {
  return `${toSafeCostingNumber(value, 0).toFixed(decimals)}%`;
}

/**
 * Formats a numeric/Decimal/string currency value safely with currency code.
 */
export function formatCostingCurrency(value: unknown, curr: string = "QAR"): string {
  const num = toSafeCostingNumber(value, 0);
  return `${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr}`;
}

/**
 * Normalizes a PreContractCostEstimateItem record so all Decimal fields serialize as JSON numbers.
 */
export function serializeCostingItem<T extends Record<string, any> | null | undefined>(item: T): any {
  if (!item) return item;
  return {
    ...item,
    quantity: toSafeCostingNumber(item.quantity, 0),
    unitRate: toSafeCostingNumber(item.unitRate, 0),
    totalAmount: toSafeCostingNumber(item.totalAmount, 0)
  };
}

/**
 * Normalizes a PreContractCostEstimateVersion record so all Decimal fields serialize as JSON numbers.
 */
export function serializeCostingVersion<T extends Record<string, any> | null | undefined>(
  version: T,
  surveyResponses?: Array<any> | null
): any {
  if (!version) return version;
  return {
    ...version,
    totalDirectCost: toSafeCostingNumber(version.totalDirectCost, 0),
    totalIndirectCost: toSafeCostingNumber(version.totalIndirectCost, 0),
    totalCost: toSafeCostingNumber(version.totalCost, 0),
    targetMarginPercentage: toSafeNullableCostingNumber(version.targetMarginPercentage),
    targetMarkupPercentage: toSafeNullableCostingNumber(version.targetMarkupPercentage),
    sellingPrice: toSafeCostingNumber(version.sellingPrice, 0),
    validationSummary: assessCostingValidation(surveyResponses, version),
    ...(Array.isArray(version.items)
      ? { items: version.items.map((item: any) => serializeCostingItem(item)) }
      : {})
  };
}

/**
 * Normalizes a PreContractCostEstimate record (and its nested versions/items) for API responses.
 */
export function serializeCostingEstimate<T extends Record<string, any> | null | undefined>(estimate: T): any {
  if (!estimate) return estimate;
  const surveyResponses = estimate?.survey?.responses ?? null;
  const serializedVersions = Array.isArray(estimate.versions)
    ? estimate.versions.map((ver: any) => serializeCostingVersion(ver, surveyResponses))
    : undefined;
  return {
    ...estimate,
    validationSummary: serializedVersions?.[0]?.validationSummary ?? assessCostingValidation(surveyResponses, null),
    ...(serializedVersions ? { versions: serializedVersions } : {})
  };
}
