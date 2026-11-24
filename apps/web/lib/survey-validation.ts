export interface SurveyResponseLike {
  elementCode: string;
  numericValue?: unknown;
  textValue?: string | null;
  booleanValue?: boolean | null;
}

export interface SurveyMissingField {
  field: "HEADCOUNT" | "RELIEVER_REQUIRED" | "COVERAGE_TYPE";
  label: string;
  reason: string;
}

export interface SurveyStaffingValidationResult {
  valid: boolean;
  missingFields: SurveyMissingField[];
  errorMessage: string;
}

const HEADCOUNT_CODES = new Set(["HEADCOUNT", "GUARDS_REQUIRED", "STAFF_COUNT"]);

/**
 * Authoritative mandatory staffing validation for Site Survey SUBMIT / APPROVE.
 * Preserves ELEM_POST_COUNT as a separate concept (pending Operations policy clarification).
 */
export function validateSurveyStaffingForSubmission(
  responses?: SurveyResponseLike[] | null
): SurveyStaffingValidationResult {
  const list = Array.isArray(responses) ? responses : [];
  const missingFields: SurveyMissingField[] = [];

  const headcountResp = list.find((r) => HEADCOUNT_CODES.has(r.elementCode));
  const headcountNum =
    headcountResp && headcountResp.numericValue !== null && headcountResp.numericValue !== undefined
      ? Number(headcountResp.numericValue)
      : NaN;
  if (!Number.isFinite(headcountNum) || headcountNum <= 0) {
    missingFields.push({
      field: "HEADCOUNT",
      label: "Approved Guard Headcount (HEADCOUNT)",
      reason: "HEADCOUNT must be a positive number (> 0).",
    });
  }

  const relieverResp = list.find((r) => r.elementCode === "RELIEVER_REQUIRED");
  if (!relieverResp || typeof relieverResp.booleanValue !== "boolean") {
    missingFields.push({
      field: "RELIEVER_REQUIRED",
      label: "Reliever Coverage Required (RELIEVER_REQUIRED)",
      reason: "RELIEVER_REQUIRED must explicitly be set to Yes (true) or No (false).",
    });
  }

  const coverageResp = list.find((r) => r.elementCode === "COVERAGE_TYPE");
  if (!coverageResp || typeof coverageResp.textValue !== "string" || coverageResp.textValue.trim().length === 0) {
    missingFields.push({
      field: "COVERAGE_TYPE",
      label: "Coverage Type (COVERAGE_TYPE)",
      reason: "COVERAGE_TYPE is required (e.g., 24/7, 12H_DAY, STANDARD).",
    });
  }

  const errorMessage =
    missingFields.length === 0
      ? ""
      : `Survey Staffing Validation Failed: Complete mandatory staffing fields before submission/approval: ${missingFields
          .map((m) => `${m.field} (${m.reason})`)
          .join("; ")}.`;

  return {
    valid: missingFields.length === 0,
    missingFields,
    errorMessage,
  };
}

/**
 * Validates the UI editingResponses map before submitting a survey.
 */
export function validateSurveyFormResponses(
  editingResponses: Record<string, any>
): SurveyStaffingValidationResult {
  const normalized: SurveyResponseLike[] = [];

  const rawHc = editingResponses["HEADCOUNT"] ?? editingResponses["GUARDS_REQUIRED"] ?? editingResponses["STAFF_COUNT"];
  if (rawHc !== undefined && rawHc !== null && String(rawHc).trim() !== "") {
    normalized.push({ elementCode: "HEADCOUNT", numericValue: Number(rawHc) });
  }

  const rawRel = editingResponses["RELIEVER_REQUIRED"];
  if (rawRel === true || rawRel === "true") {
    normalized.push({ elementCode: "RELIEVER_REQUIRED", booleanValue: true });
  } else if (rawRel === false || rawRel === "false") {
    normalized.push({ elementCode: "RELIEVER_REQUIRED", booleanValue: false });
  }

  const rawCov = editingResponses["COVERAGE_TYPE"];
  if (typeof rawCov === "string" && rawCov.trim().length > 0) {
    normalized.push({ elementCode: "COVERAGE_TYPE", textValue: rawCov.trim() });
  }

  return validateSurveyStaffingForSubmission(normalized);
}
