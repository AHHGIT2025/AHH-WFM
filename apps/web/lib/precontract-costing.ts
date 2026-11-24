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
  hasMappedReliefDriver: boolean;
  assumedFallbackHeadcount: boolean;
  unmappedSurveyManpowerFields: string[];
  missingMandatoryFields: string[];
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

  const unmappedPostCount = !hasMappedSurveyHeadcount
    ? responses.some((r) => {
        if (r.elementCode !== "ELEM_POST_COUNT") return false;
        const hasNum = r.numericValue !== null && r.numericValue !== undefined && Number(r.numericValue) > 0;
        const hasText = typeof r.textValue === "string" && r.textValue.trim().length > 0;
        return hasNum || hasText;
      })
    : false;

  const hasMappedReliefDriver = responses.some(
    (r) =>
      (r.elementCode === "RELIEVER_REQUIRED" && typeof r.booleanValue === "boolean") ||
      (r.elementCode === "COVERAGE_TYPE" && typeof r.textValue === "string" && r.textValue.trim().length > 0)
  );
  const unmappedShiftPattern = !hasMappedReliefDriver
    ? responses.some((r) => {
        if (r.elementCode !== "ELEM_SHIFT_PATTERN") return false;
        const hasNum = r.numericValue !== null && r.numericValue !== undefined && Number(r.numericValue) > 0;
        const hasText = typeof r.textValue === "string" && r.textValue.trim().length > 0;
        return hasNum || hasText;
      })
    : false;

  const unmappedSurveyManpowerFields: string[] = [];
  if (unmappedPostCount) unmappedSurveyManpowerFields.push("ELEM_POST_COUNT");
  if (unmappedShiftPattern) unmappedSurveyManpowerFields.push("ELEM_SHIFT_PATTERN");

  const basicItem = items.find((i) => i.elementCode === "BASIC_PAY");
  const allowanceItem = items.find((i) => i.elementCode === "ALLOWANCES");
  const relieverItem = items.find((i) => i.elementCode === "RELIEVER_COST");

  const parseOverrideAudit = (fieldPath: string) =>
    overrides.filter(
      (o) =>
        o.fieldPath === fieldPath &&
        typeof o.reason === "string" &&
        o.reason.trim().length >= 3 &&
        typeof (o as any).overriddenBy === "string" &&
        (o as any).overriddenBy.trim().length > 0
    );

  const basicOverrideLogs = parseOverrideAudit("items[BASIC_PAY]");
  const allowanceOverrideLogs = parseOverrideAudit("items[ALLOWANCES]");
  const relieverOverrideLogs = parseOverrideAudit("items[RELIEVER_COST]");

  const hasBasicPayQuantityOverride =
    basicItem?.calculationBasis === "OVERRIDE" &&
    basicOverrideLogs.some((o) => /qty=([0-9]*\.?[0-9]+)/.test((o as any).newValue || "") && Number(RegExp.$1) > 0);

  const hasBasicPayRateOverride =
    basicItem?.calculationBasis === "OVERRIDE" &&
    basicOverrideLogs.some((o) => /rate=([0-9]*\.?[0-9]+)/.test((o as any).newValue || "") && Number(RegExp.$1) > 0);

  const hasAllowanceQuantityOverride =
    allowanceItem?.calculationBasis === "OVERRIDE" &&
    allowanceOverrideLogs.some((o) => /qty=([0-9]*\.?[0-9]+)/.test((o as any).newValue || "") && Number(RegExp.$1) > 0);

  const hasAllowanceRateOverride =
    allowanceItem?.calculationBasis === "OVERRIDE" &&
    allowanceOverrideLogs.some((o) => /rate=([0-9]*\.?[0-9]+)/.test((o as any).newValue || "") && Number(RegExp.$1) > 0);

  const hasRelieverRateOverride =
    relieverItem?.calculationBasis === "OVERRIDE" &&
    relieverOverrideLogs.some((o) => /rate=([0-9]*\.?[0-9]+)/.test((o as any).newValue || "") && Number(RegExp.$1) >= 0);

  const hasAllowanceOverride = hasAllowanceQuantityOverride || hasAllowanceRateOverride;

  const assumedFallbackHeadcount = !hasMappedSurveyHeadcount && !hasBasicPayQuantityOverride;
  const hasConfiguredRateCardItems =
    basicItem?.calculationBasis === "CONFIGURED" &&
    allowanceItem?.calculationBasis === "CONFIGURED";
  const hasActiveCostConfig = Boolean(version?.costConfigVersionId) || hasConfiguredRateCardItems;

  const fallbackRateItems: string[] = [];

  if (
    basicItem &&
    !hasBasicPayRateOverride &&
    (basicItem.calculationBasis === "FALLBACK" || !hasActiveCostConfig)
  ) {
    fallbackRateItems.push("BASIC_PAY");
  }
  if (
    allowanceItem &&
    !hasAllowanceRateOverride &&
    (allowanceItem.calculationBasis === "FALLBACK" || (!hasActiveCostConfig && Number(allowanceItem.unitRate) === 1000))
  ) {
    fallbackRateItems.push("ALLOWANCES");
  }
  if (
    relieverItem &&
    !hasRelieverRateOverride &&
    (relieverItem.calculationBasis === "FALLBACK" || relieverItem.calculationBasis === "SURVEY_REQUIREMENT" || !hasActiveCostConfig)
  ) {
    fallbackRateItems.push("RELIEVER_COST");
  }

  const usesFallbackRates = fallbackRateItems.length > 0;
  const hasAllFallbacksOverridden =
    (!assumedFallbackHeadcount || hasBasicPayQuantityOverride) &&
    (!unmappedShiftPattern) &&
    (!fallbackRateItems.includes("BASIC_PAY") || hasBasicPayRateOverride) &&
    (!fallbackRateItems.includes("ALLOWANCES") || hasAllowanceOverride) &&
    (!fallbackRateItems.includes("RELIEVER_COST") || hasRelieverRateOverride);

  const missingMandatoryFields: string[] = [];
  if (!hasMappedSurveyHeadcount) {
    missingMandatoryFields.push("HEADCOUNT");
  }
  if (!hasMappedReliefDriver) {
    missingMandatoryFields.push("RELIEVER_REQUIRED / COVERAGE_TYPE");
  }

  const warnings: string[] = [];
  if (unmappedPostCount && !hasBasicPayQuantityOverride) {
    warnings.push(
      "Survey captured unmapped ELEM_POST_COUNT; costing defaulted to assumed headcount = 1. A BASIC_PAY quantity override is required."
    );
  } else if (assumedFallbackHeadcount) {
    warnings.push(
      "Survey lacks mapped headcount drivers (HEADCOUNT / GUARDS_REQUIRED / STAFF_COUNT); costing defaulted to assumed headcount = 1."
    );
  }
  if (!hasMappedReliefDriver) {
    warnings.push(
      "Survey lacks required relief/coverage driver (RELIEVER_REQUIRED or COVERAGE_TYPE)."
    );
  }
  if (unmappedShiftPattern) {
    warnings.push(
      "Survey captured unmapped ELEM_SHIFT_PATTERN (relief coverage); BASIC_PAY overrides do not validate shift/relief coverage."
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
  if (relieverItem && relieverItem.calculationBasis !== "OVERRIDE") {
    warnings.push(
      "RELIEVER_COST quantity uses the 15% baseline formula (ceil(headcount * 0.15)); rate source is independent and quantity policy remains pending Operations approval."
    );
  }
  const relieverReqRespVal = responses.find((r) => r.elementCode === "RELIEVER_REQUIRED");
  const coverageRespVal = responses.find((r) => r.elementCode === "COVERAGE_TYPE");
  if (relieverReqRespVal?.booleanValue === false && coverageRespVal?.textValue?.includes("24/7")) {
    warnings.push(
      "Survey specifies RELIEVER_REQUIRED=false alongside 24/7 COVERAGE_TYPE; confirm Operations policy approval."
    );
  }

  let validationStatus: CostingValidationSummary["validationStatus"] = "UNVALIDATED_FALLBACK";
  if (hasMappedSurveyHeadcount && hasMappedReliefDriver && !unmappedShiftPattern && hasActiveCostConfig && !usesFallbackRates) {
    validationStatus = "VALIDATED_CONFIGURED";
  } else if (overrides.length > 0 && hasAllFallbacksOverridden) {
    validationStatus = "VALIDATED_BY_OVERRIDE";
  } else if (version?.status === "APPROVED") {
    validationStatus = "UNVALIDATED_LEGACY_APPROVED";
  }

  const isValidated =
    validationStatus === "VALIDATED_CONFIGURED" || validationStatus === "VALIDATED_BY_OVERRIDE";
  const ratesValidated =
    (!usesFallbackRates && hasActiveCostConfig) ||
    (hasBasicPayRateOverride &&
      hasAllowanceOverride &&
      (!relieverItem || !fallbackRateItems.includes("RELIEVER_COST") || hasRelieverRateOverride));
  const blocksCommercialSubmission =
    !hasMappedSurveyHeadcount ||
    !hasMappedReliefDriver ||
    unmappedPostCount ||
    unmappedShiftPattern ||
    !ratesValidated;

  return {
    validationStatus,
    isValidated,
    requiresValidation: !isValidated,
    blocksCommercialSubmission,
    hasMappedSurveyHeadcount,
    hasMappedReliefDriver,
    assumedFallbackHeadcount,
    unmappedSurveyManpowerFields,
    missingMandatoryFields,
    hasActiveCostConfig,
    usesFallbackRates,
    fallbackRateItems,
    overrideAuditCount: overrides.length,
    warnings,
  };
}

/**
 * Formats an actionable, non-contradictory DEF-104 guard error message from the
 * actual blocking conditions in CostingValidationSummary.
 */
export function formatCostingValidationBlockError(
  summary: CostingValidationSummary,
  actionLabel: string,
  guardTitle: string = "DEF-104 Costing Validation Guard"
): string {
  const reasons: string[] = [];

  if (summary.unmappedSurveyManpowerFields.length > 0) {
    reasons.push(
      `Survey captured unmapped manpower fields (${summary.unmappedSurveyManpowerFields.join(", ")})` +
        (summary.assumedFallbackHeadcount ? " while costing defaulted to assumed headcount = 1" : "")
    );
  } else if (!summary.hasMappedSurveyHeadcount) {
    reasons.push(
      "Survey is missing Operations-approved headcount (HEADCOUNT / GUARDS_REQUIRED / STAFF_COUNT)"
    );
  }

  if (!summary.hasMappedReliefDriver) {
    reasons.push("Survey is missing required relief/coverage driver (RELIEVER_REQUIRED or COVERAGE_TYPE)");
  }

  if (!summary.hasActiveCostConfig || summary.usesFallbackRates) {
    const fallbackNote =
      summary.fallbackRateItems.length > 0
        ? ` (fallback rates active on: ${summary.fallbackRateItems.join(", ")})`
        : "";
    reasons.push(`No approved ACTIVE PC-2A Rate Card / Cost Configuration is active${fallbackNote}`);
  }

  if (reasons.length === 0) {
    reasons.push("Costing validation requirements are incomplete");
  }

  return `${guardTitle}: ${reasons.join("; ")}. Resolve before ${actionLabel}.`;
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

  // 3. Resolve Effective PC-2A Cost Rate Card Version (authoritative), falling back to legacy CostConfigurationVersion only if PC-2A has none
  const effDate = new Date(effectiveDate);
  const effTime = effDate.getTime();
  const targetCompanyId = params.companyId ?? opCase.companyId ?? null;
  const targetOperationType = params.operationType ?? opCase.operationType ?? null;

  let pc2aRateCardVersion: any = null;
  let hasAnyPc2aRateCardForScope = false;
  if ((prisma as any).costRateCardMaster?.findMany) {
    const rateCardMasters = await (prisma as any).costRateCardMaster.findMany({
      where: {
        OR: [
          ...(targetCompanyId ? [{ companyId: targetCompanyId }] : []),
          { companyId: null }
        ]
      },
      include: {
        versions: {
          where: { status: "ACTIVE" }
        }
      }
    });
    hasAnyPc2aRateCardForScope = Array.isArray(rateCardMasters) && rateCardMasters.length > 0;

    const eligiblePc2a: Array<{ version: any; master: any; specificity: number }> = [];
    for (const master of rateCardMasters || []) {
      if (master.companyId && targetCompanyId && master.companyId !== targetCompanyId) {
        continue;
      }
      for (const ver of master.versions || []) {
        // Verify Maker/Checker approval on ACTIVE version
        if (!ver.approvedBy || ver.approvedBy === ver.createdBy) {
          continue;
        }
        const from = new Date(ver.effectiveFrom).getTime();
        const to = ver.effectiveTo ? new Date(ver.effectiveTo).getTime() : Infinity;
        if (from <= effTime && effTime < to) {
          eligiblePc2a.push({
            version: ver,
            master,
            specificity: master.companyId ? 2 : 1
          });
        }
      }
    }

    if (eligiblePc2a.length > 0) {
      const maxSpec = Math.max(...eligiblePc2a.map((c) => c.specificity));
      const topMatches = eligiblePc2a.filter((c) => c.specificity === maxSpec);
      if (topMatches.length > 1) {
        throw new Error(
          `Ambiguous PC-2A Cost Configuration: ${topMatches.length} ACTIVE CostRateCardVersion records match the same company scope and effective date.`
        );
      }
      pc2aRateCardVersion = topMatches[0];
    }
  }

  // Verify PC-2A CostElementMaster operationType compatibility when element masters exist
  if (pc2aRateCardVersion && targetOperationType && (prisma as any).costElementMaster?.findMany) {
    const elemMasters = await (prisma as any).costElementMaster.findMany({
      where: {
        code: { in: ["BASIC_PAY", "ALLOWANCES"] },
        OR: [
          ...(targetCompanyId ? [{ companyId: targetCompanyId }] : []),
          { companyId: null }
        ]
      }
    });
    for (const em of elemMasters || []) {
      if (em.operationType && em.operationType !== targetOperationType) {
        pc2aRateCardVersion = null;
        break;
      }
    }
  }

  // Legacy CostConfigurationVersion only consulted when no PC-2A rate card master exists for the scope
  const activeVersion =
    pc2aRateCardVersion || hasAnyPc2aRateCardForScope
      ? null
      : await prisma.costConfigurationVersion.findFirst({
        where: {
          status: "ACTIVE",
          ...(targetCompanyId ? { OR: [{ companyId: targetCompanyId }, { companyId: null }] } : {}),
          ...(targetOperationType ? { OR: [{ operationType: targetOperationType }, { operationType: null }] } : {}),
          effectiveFrom: { lte: effDate },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gt: effDate } }
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

  const costConfigVersionId = pc2aRateCardVersion?.version?.id || activeVersion?.id || null;

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

  // Determine currency from PC-2A rate card, legacy rates, or default QAR
  let currency = "QAR";
  if (pc2aRateCardVersion?.master?.currency) {
    currency = pc2aRateCardVersion.master.currency;
  } else if (activeVersion?.rates && activeVersion.rates.length > 0) {
    const rc = activeVersion.rates[0];
    if (rc && rc.currency) {
      currency = rc.currency;
    }
  }

  // Build Manpower Direct Cost Line
  const pc2aRatesMap = (pc2aRateCardVersion?.version?.ratesJson && typeof pc2aRateCardVersion.version.ratesJson === "object")
    ? (pc2aRateCardVersion.version.ratesJson as Record<string, any>)
    : null;
  const pc2aBasicRate =
    pc2aRatesMap && Number.isFinite(Number(pc2aRatesMap["BASIC_PAY"])) && Number(pc2aRatesMap["BASIC_PAY"]) > 0
      ? Number(pc2aRatesMap["BASIC_PAY"])
      : null;

  const basicPayElement = activeVersion?.elements?.find(
    (e: any) => e.code === "BASIC_PAY" || (e.name && e.name.toLowerCase().includes("basic"))
  );
  const basicPayRateRow = activeVersion?.rates?.find((r: any) => r.elementCode === "BASIC_PAY");
  const configuredBasicRate =
    pc2aBasicRate !== null
      ? pc2aBasicRate
      : basicPayRateRow && Number.isFinite(Number(basicPayRateRow.rateValue)) && Number(basicPayRateRow.rateValue) > 0
        ? Number(basicPayRateRow.rateValue)
        : (basicPayElement as any)?.baseRate && Number((basicPayElement as any).baseRate) > 0
          ? Number((basicPayElement as any).baseRate)
          : null;
  const hasConfiguredBasicRate = configuredBasicRate !== null;
  let basicUnitRate = new Decimal(2500); // Baseline monthly rate per headcount
  if (hasConfiguredBasicRate) {
    basicUnitRate = new Decimal(configuredBasicRate!.toString());
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
  const pc2aAllowanceRate =
    pc2aRatesMap && pc2aRatesMap["ALLOWANCES"] !== undefined && Number.isFinite(Number(pc2aRatesMap["ALLOWANCES"])) && Number(pc2aRatesMap["ALLOWANCES"]) >= 0
      ? Number(pc2aRatesMap["ALLOWANCES"])
      : null;
  const allowanceRateRow = activeVersion?.rates?.find((r: any) => r.elementCode === "ALLOWANCES");
  const configuredAllowanceRate =
    pc2aAllowanceRate !== null
      ? pc2aAllowanceRate
      : allowanceRateRow && Number.isFinite(Number(allowanceRateRow.rateValue)) && Number(allowanceRateRow.rateValue) >= 0
        ? Number(allowanceRateRow.rateValue)
        : null;
  const hasConfiguredAllowanceRate = configuredAllowanceRate !== null;
  let allowanceUnitRate = new Decimal(1000);
  if (hasConfiguredAllowanceRate) {
    allowanceUnitRate = new Decimal(configuredAllowanceRate!.toString());
  }
  const allowanceOverride = overrides.find((o) => o.elementCode === "ALLOWANCES");
  let allowanceCalcBasis =
    hasMappedHeadcount && hasConfiguredAllowanceRate ? "CONFIGURED" : "FALLBACK";
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

  // Check Reliever Cost Line: explicit RELIEVER_REQUIRED=false disables reliever; otherwise RELIEVER_REQUIRED=true or 24/7 coverage triggers reliever line
  const relieverReqResponse = survey.responses.find((r) => r.elementCode === "RELIEVER_REQUIRED");
  const coverageTypeResponse = survey.responses.find((r) => r.elementCode === "COVERAGE_TYPE");
  const explicitNoRelief = relieverReqResponse?.booleanValue === false;
  const requiresRelief =
    !explicitNoRelief &&
    Boolean(relieverReqResponse?.booleanValue === true || coverageTypeResponse?.textValue?.includes("24/7"));
  if (requiresRelief) {
    let relieverHeadcount = Math.max(1, Math.ceil(totalHeadcount * 0.15));
    const pc2aRelieverRate =
      pc2aRatesMap &&
      pc2aRatesMap["RELIEVER_COST"] !== undefined &&
      Number.isFinite(Number(pc2aRatesMap["RELIEVER_COST"])) &&
      Number(pc2aRatesMap["RELIEVER_COST"]) >= 0
        ? Number(pc2aRatesMap["RELIEVER_COST"])
        : null;
    const relieverRateRow = activeVersion?.rates?.find((r: any) => r.elementCode === "RELIEVER_COST");
    const configuredRelieverRate =
      pc2aRelieverRate !== null
        ? pc2aRelieverRate
        : relieverRateRow && Number.isFinite(Number(relieverRateRow.rateValue)) && Number(relieverRateRow.rateValue) >= 0
          ? Number(relieverRateRow.rateValue)
          : null;
    const hasConfiguredRelieverRate = configuredRelieverRate !== null;
    let relieverUnitRate = basicUnitRate.add(allowanceUnitRate);
    if (hasConfiguredRelieverRate) {
      relieverUnitRate = new Decimal(configuredRelieverRate!.toString());
    }
    const relieverOverride = overrides.find((o) => o.elementCode === "RELIEVER_COST");
    let relieverCalcBasis =
      hasMappedHeadcount && hasConfiguredRelieverRate ? "CONFIGURED" : "FALLBACK";
    let relieverOverrideReason: string | null = hasConfiguredRelieverRate
      ? "Rate: configured PC-2A/CostConfig; Qty: 15% baseline formula (pending Operations policy approval)"
      : "Rate: fallback baseline; Qty: 15% baseline formula (pending Operations policy approval)";
    if (relieverOverride && (relieverOverride.unitRate !== undefined || relieverOverride.quantity !== undefined)) {
      if (relieverOverride.unitRate !== undefined) {
        relieverUnitRate = new Decimal(relieverOverride.unitRate);
      }
      if (relieverOverride.quantity !== undefined && relieverOverride.quantity > 0) {
        relieverHeadcount = relieverOverride.quantity;
      }
      relieverCalcBasis = "OVERRIDE";
      relieverOverrideReason = relieverOverride.reason || "Manual reliever override";
    }
    const relieverQty = new Decimal(relieverHeadcount);
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
      calculationBasis: relieverCalcBasis,
      overrideReason: relieverOverrideReason
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
