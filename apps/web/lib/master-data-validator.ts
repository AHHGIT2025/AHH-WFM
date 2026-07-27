import { prisma } from "@ahh-wfm/database";

export async function validateCompanyDepartment(companyId: string, departmentId?: string | null) {
  if (!departmentId) return true;
  const dept = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!dept) {
    throw new Error(`DEPARTMENT_NOT_FOUND: Department ID ${departmentId} does not exist`);
  }
  if (dept.companyId && dept.companyId !== companyId) {
    throw new Error(`DEPARTMENT_COMPANY_MISMATCH: Department ${dept.name} (${departmentId}) does not belong to Company ${companyId}`);
  }
  return true;
}

export function validatePositionApplicability(params: {
  workerClass: "WHITE_COLLAR" | "BLUE_COLLAR";
  appliesToAllPositionCategories?: boolean | null;
  positionCategoryId?: string | null;
}) {
  if (params.workerClass === "WHITE_COLLAR") {
    if (params.appliesToAllPositionCategories != null || params.positionCategoryId != null) {
      throw new Error("POSITION_APPLICABILITY_INVALID: White Collar profiles cannot specify Position Category or appliesToAllPositionCategories");
    }
  } else if (params.workerClass === "BLUE_COLLAR") {
    if (params.appliesToAllPositionCategories === true) {
      if (params.positionCategoryId != null) {
        throw new Error("POSITION_APPLICABILITY_INVALID: Blue Collar all-position profile must leave positionCategoryId null");
      }
    } else if (params.appliesToAllPositionCategories === false) {
      if (!params.positionCategoryId) {
        throw new Error("BLUE_COLLAR_POSITION_CATEGORY_REQUIRED: Blue Collar specific-position profile requires positionCategoryId");
      }
    } else {
      throw new Error("POSITION_APPLICABILITY_INVALID: Blue Collar profile must explicitly specify appliesToAllPositionCategories (true/false)");
    }
  }
}

export function validateSeasonalRuleScopeAndTimeWindow(rule: {
  ruleScope: "COMPANY_WIDE" | "POSITION_CATEGORY" | "PROFILE_SPECIFIC";
  companyId: string;
  positionCategoryId?: string | null;
  profileId?: string | null;
  morningStartMinutes: number;
  morningEndMinutes: number;
  mandatoryBreakStartMinutes: number;
  mandatoryBreakEndMinutes: number;
  eveningStartMinutes?: number | null;
  eveningEndMinutes?: number | null;
  allowedDailyMinutes: number;
}) {
  // Scope validation
  if (rule.ruleScope === "COMPANY_WIDE") {
    if (!rule.companyId || rule.positionCategoryId != null || rule.profileId != null) {
      throw new Error("SEASONAL_RULE_SCOPE_INVALID: COMPANY_WIDE rule requires companyId and must leave positionCategoryId and profileId null");
    }
  } else if (rule.ruleScope === "POSITION_CATEGORY") {
    if (!rule.companyId || !rule.positionCategoryId || rule.profileId != null) {
      throw new Error("SEASONAL_RULE_SCOPE_INVALID: POSITION_CATEGORY rule requires companyId and positionCategoryId, and must leave profileId null");
    }
  } else if (rule.ruleScope === "PROFILE_SPECIFIC") {
    if (!rule.profileId) {
      throw new Error("SEASONAL_RULE_SCOPE_INVALID: PROFILE_SPECIFIC rule requires profileId");
    }
  }

  // Time window validation
  if (rule.morningStartMinutes >= rule.morningEndMinutes) {
    throw new Error("TIME_WINDOW_INVALID: morningStartMinutes must be less than morningEndMinutes");
  }
  if (rule.morningEndMinutes > rule.mandatoryBreakStartMinutes) {
    throw new Error("TIME_WINDOW_INVALID: morningEndMinutes cannot be after mandatoryBreakStartMinutes");
  }
  if (rule.mandatoryBreakStartMinutes >= rule.mandatoryBreakEndMinutes) {
    throw new Error("TIME_WINDOW_INVALID: mandatoryBreakStartMinutes must be less than mandatoryBreakEndMinutes");
  }

  if (rule.eveningStartMinutes != null && rule.eveningEndMinutes != null) {
    if (rule.mandatoryBreakEndMinutes > rule.eveningStartMinutes) {
      throw new Error("TIME_WINDOW_INVALID: mandatoryBreakEndMinutes cannot be after eveningStartMinutes");
    }
    if (rule.eveningStartMinutes >= rule.eveningEndMinutes) {
      throw new Error("TIME_WINDOW_INVALID: eveningStartMinutes must be less than eveningEndMinutes");
    }
  }

  if (rule.allowedDailyMinutes <= 0) {
    throw new Error("TIME_WINDOW_INVALID: allowedDailyMinutes must be greater than zero");
  }
}

export function validateRestDayLifecycle(params: {
  workerClass: "WHITE_COLLAR" | "BLUE_COLLAR";
  approvalStatus?: string;
  restDays?: string[];
}) {
  if (params.approvalStatus === "APPROVED" || params.approvalStatus === "SUPERSEDED") {
    throw new Error("REST_DAY_IMMUTABLE: Approved or superseded profiles cannot modify rest days directly. Create a new profile version.");
  }
  if (params.workerClass === "BLUE_COLLAR" && params.restDays && params.restDays.length > 0) {
    throw new Error("FIXED_REST_FORBIDDEN: Blue Collar profiles use ROSTER_MANAGED rest and cannot store fixed rest-day rows.");
  }
  if (params.workerClass === "WHITE_COLLAR" && (!params.restDays || params.restDays.length === 0)) {
    throw new Error("WHITE_COLLAR_REST_DAY_REQUIRED: White Collar profiles require at least one fixed weekly rest day.");
  }
}
