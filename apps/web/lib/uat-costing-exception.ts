import { hasPermission, isAdminUser } from "./permissions";
import type { CostingValidationSummary } from "./precontract-costing";

export const UAT_UNVALIDATED_COSTING_BANNER = "UAT ONLY — UNVALIDATED COSTING";

/**
 * Checks whether the current authenticated approver is the same user who
 * submitted or created the costing workflow, using stable authenticated IDs
 * (and legacy email match if a prior SUBMIT stored email).
 * Never relies solely on display labels like "UAT Creator".
 */
export function hasSubmitterApproverConflict(params: {
  user: any;
  workflowHistory?: Array<{ action: string; actedBy?: string | null; createdAt?: Date | string }> | null;
  creatorIds?: Array<string | null | undefined>;
}): { conflict: boolean; matchedActor: string | null } {
  const { user, workflowHistory, creatorIds = [] } = params;
  const userTokens = new Set(
    [user?.id, user?.employeeId, user?.email]
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => v.trim().toLowerCase())
  );
  if (userTokens.size === 0) return { conflict: false, matchedActor: null };

  // 1. Check latest SUBMIT actor in workflow history (authoritative for actual logged-in Maker)
  if (Array.isArray(workflowHistory) && workflowHistory.length > 0) {
    const submitEntries = workflowHistory
      .filter((h) => h.action === "SUBMIT" && typeof h.actedBy === "string" && h.actedBy.trim().length > 0)
      .sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
    const latestSubmitActor = submitEntries[0]?.actedBy?.trim();
    if (latestSubmitActor && userTokens.has(latestSubmitActor.toLowerCase())) {
      return { conflict: true, matchedActor: latestSubmitActor };
    }
  }

  // 2. Check explicit creator IDs (e.g., estimate.createdBy, version.createdBy)
  for (const cid of creatorIds) {
    if (typeof cid === "string" && cid.trim().length > 0 && userTokens.has(cid.trim().toLowerCase())) {
      return { conflict: true, matchedActor: cid.trim() };
    }
  }

  return { conflict: false, matchedActor: null };
}

export interface UatCostingExceptionContext {
  estimate: {
    id: string;
    caseId?: string | null;
    estimateCode?: string | null;
  };
  validationSummary: CostingValidationSummary;
  user: any;
  action: "SUBMIT" | "APPROVE";
  reason?: string | null;
}

export interface UatCostingExceptionDecision {
  allowed: boolean;
  banner: string | null;
  bypassedChecks: string[];
  denialReason: string | null;
  auditPayload: {
    banner: string;
    userId: string;
    userEmail: string | null;
    userRole: string;
    action: "SUBMIT" | "APPROVE";
    reason: string;
    recordedAt: string;
    estimateId: string;
    estimateCode: string | null;
    caseId: string | null;
    bypassedChecks: string[];
  } | null;
}

function parseCsvEnv(raw?: string | null): string[] {
  if (!raw) return [];
  const entries = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (entries.some((s) => s.includes("*"))) {
    return [];
  }
  return entries;
}

/**
 * Checks whether the server-side UAT costing exception feature flag is explicitly enabled
 * and whether the given costing record's EXACT synthetic estimate ID is in the explicit allowlist.
 * Disabled by default. Never accepts wildcard "*", case-wide IDs, COST-prefix codes, or empty allowlists.
 */
export function isAllowlistedUatCostingRecord(estimate: {
  id: string;
  caseId?: string | null;
  estimateCode?: string | null;
}): boolean {
  if (process.env.AHH_WFM_UAT_COSTING_EXCEPTION_ENABLED !== "true") {
    return false;
  }
  const allowlist = parseCsvEnv(process.env.AHH_WFM_UAT_COSTING_ALLOWLIST);
  if (allowlist.length === 0) {
    return false;
  }
  const exactEstimateId = typeof estimate.id === "string" ? estimate.id.trim().toLowerCase() : "";
  if (!exactEstimateId) {
    return false;
  }

  return allowlist.some((entry) => entry.toLowerCase() === exactEstimateId);
}

/**
 * Evaluates whether a tightly scoped UAT-only exception may bypass ONLY the
 * missing ACTIVE PC-2A rate card / fallback-rate block during SUBMIT or APPROVE.
 *
 * Strictly preserves:
 * - Default-off server-side feature flag
 * - Explicit synthetic record allowlist
 * - Authorized UAT user & RBAC check
 * - Mandatory staffing/headcount and survey consistency (NEVER bypassed)
 * - Downstream hard blocks on client issuance and contract conversion
 */
export function evaluateUatCostingException(
  ctx: UatCostingExceptionContext
): UatCostingExceptionDecision {
  const { estimate, validationSummary, user, action, reason } = ctx;

  // 1. Server-side feature flag must be explicitly enabled
  if (process.env.AHH_WFM_UAT_COSTING_EXCEPTION_ENABLED !== "true") {
    return {
      allowed: false,
      banner: null,
      bypassedChecks: [],
      denialReason: "UAT costing exception feature flag is disabled.",
      auditPayload: null,
    };
  }

  // 2. Record must be explicitly allowlisted (no wildcards)
  if (!isAllowlistedUatCostingRecord(estimate)) {
    return {
      allowed: false,
      banner: null,
      bypassedChecks: [],
      denialReason: "Costing record is not in AHH_WFM_UAT_COSTING_ALLOWLIST.",
      auditPayload: null,
    };
  }

  // 3. Actor must be authorized for the requested workflow action + optional explicit UAT user list
  const hasActionPerm =
    isAdminUser(user) ||
    hasPermission(user, "manpower.admin.full_access") ||
    (action === "SUBMIT" &&
      (hasPermission(user, "precontract.workflow.submit") ||
        hasPermission(user, "precontract.costing.manage"))) ||
    (action === "APPROVE" &&
      (hasPermission(user, "precontract.workflow.approve") ||
        hasPermission(user, "precontract.workflow.review")));

  if (!hasActionPerm) {
    return {
      allowed: false,
      banner: null,
      bypassedChecks: [],
      denialReason: `User is not authorized for ${action} under UAT costing exception.`,
      auditPayload: null,
    };
  }

  // 3b. Authorized-user allowlist MUST be non-empty and enforced for ALL roles (including ADMIN & SUPER_ADMIN)
  const authorizedUsers = parseCsvEnv(process.env.AHH_WFM_UAT_COSTING_AUTHORIZED_USERS);
  if (authorizedUsers.length === 0) {
    return {
      allowed: false,
      banner: null,
      bypassedChecks: [],
      denialReason: "AHH_WFM_UAT_COSTING_AUTHORIZED_USERS must be non-empty to use UAT costing exception.",
      auditPayload: null,
    };
  }
  const userTokens = [user?.id, user?.email, user?.employeeId]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim().toLowerCase());
  const userAllowed = authorizedUsers.some((entry) => userTokens.includes(entry.toLowerCase()));
  if (!userAllowed) {
    return {
      allowed: false,
      banner: null,
      bypassedChecks: [],
      denialReason: "User is not in AHH_WFM_UAT_COSTING_AUTHORIZED_USERS.",
      auditPayload: null,
    };
  }

  // 4. NEVER bypass mandatory staffing/headcount or survey consistency guards
  if (
    !validationSummary.hasMappedSurveyHeadcount ||
    !validationSummary.hasMappedReliefDriver ||
    validationSummary.assumedFallbackHeadcount ||
    validationSummary.unmappedSurveyManpowerFields.length > 0
  ) {
    return {
      allowed: false,
      banner: null,
      bypassedChecks: [],
      denialReason:
        "UAT exception cannot bypass mandatory survey headcount, relief driver, or unmapped staffing validations.",
      auditPayload: null,
    };
  }

  // 5. Exception applies ONLY to missing ACTIVE rate card / fallback unit rates
  const bypassedChecks: string[] = [];
  if (!validationSummary.hasActiveCostConfig) {
    bypassedChecks.push("NO_ACTIVE_PC2A_RATE_CARD");
  }
  for (const item of validationSummary.fallbackRateItems) {
    bypassedChecks.push(`FALLBACK_RATE:${item}`);
  }

  if (bypassedChecks.length === 0) {
    return {
      allowed: false,
      banner: null,
      bypassedChecks: [],
      denialReason: "No fallback-rate condition eligible for UAT exception.",
      auditPayload: null,
    };
  }

  const normalizedReason =
    typeof reason === "string" && reason.trim().length > 0
      ? reason.trim()
      : `Authorized UAT-only fallback rate exception for ${action}`;

  return {
    allowed: true,
    banner: UAT_UNVALIDATED_COSTING_BANNER,
    bypassedChecks,
    denialReason: null,
    auditPayload: {
      banner: UAT_UNVALIDATED_COSTING_BANNER,
      userId: String(user?.id || "unknown"),
      userEmail: user?.email ? String(user.email) : null,
      userRole: String(user?.role || "UNKNOWN"),
      action,
      reason: normalizedReason,
      recordedAt: new Date().toISOString(),
      estimateId: estimate.id,
      estimateCode: estimate.estimateCode || null,
      caseId: estimate.caseId || null,
      bypassedChecks,
    },
  };
}
