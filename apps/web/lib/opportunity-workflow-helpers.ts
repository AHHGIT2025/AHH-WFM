import { hasPermission, isAdminUser } from "./permissions";

export interface OpportunityUserContext {
  id?: string | null;
  email?: string | null;
  role?: string;
  permissions?: string[];
}

export interface OpportunityOwnershipRecord {
  createdBy?: string | null;
}

/**
 * Checks whether the authenticated user created the given commercial opportunity.
 */
export function isOpportunityOwner(
  user: OpportunityUserContext | null | undefined,
  opportunity: OpportunityOwnershipRecord | null | undefined
): boolean {
  if (!user || !opportunity?.createdBy) return false;
  return (
    (Boolean(user.id) && opportunity.createdBy === user.id) ||
    (Boolean(user.email) && opportunity.createdBy === user.email)
  );
}

/**
 * DEF-089: Standard creators may submit only opportunities they created.
 * Authorized administrators may submit on behalf of another user only when
 * explicitly permitted (ADMIN / SUPER_ADMIN / manpower.admin.full_access).
 */
export function canSubmitOpportunity(
  user: OpportunityUserContext | null | undefined,
  opportunity: OpportunityOwnershipRecord | null | undefined
): boolean {
  if (!user) return false;
  const hasSubmitPerm =
    isAdminUser(user) ||
    hasPermission(user, "precontract.workflow.submit") ||
    hasPermission(user, "precontract.case.manage") ||
    hasPermission(user, "manpower.admin.full_access");
  if (!hasSubmitPerm) return false;

  return (
    isOpportunityOwner(user, opportunity) ||
    isAdminUser(user) ||
    hasPermission(user, "manpower.admin.full_access")
  );
}

/**
 * DEF-057: UI/action eligibility for approving or rejecting an opportunity.
 * Creators must never see approval actions for their own opportunity (including SUPER_ADMIN under SoD).
 */
export function canApproveOpportunity(
  user: OpportunityUserContext | null | undefined,
  opportunity: OpportunityOwnershipRecord | null | undefined
): boolean {
  if (!user) return false;
  if (isOpportunityOwner(user, opportunity)) return false;
  return (
    isAdminUser(user) ||
    hasPermission(user, "precontract.workflow.approve") ||
    hasPermission(user, "precontract.workflow.review") ||
    hasPermission(user, "manpower.admin.full_access")
  );
}
