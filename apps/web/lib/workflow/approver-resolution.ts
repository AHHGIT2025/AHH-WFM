import { prisma } from "@ahh-wfm/database";

export interface WorkflowApproverDefinition {
  id?: string;
  approverType: string; // "SPECIFIC_EMPLOYEE" | "ROLE_BASED" | "DEPT_HEAD" | etc.
  employeeId?: string | null;
  employeeName?: string | null;
  roleName?: string | null;
}

export interface UserSessionContext {
  id: string; // UserAccount.id
  employeeId?: string | null; // Employee.id
  role?: string | null;
  companyId?: string | null;
}

export interface ApproverEligibilityResult {
  isEligible: boolean;
  isExplicit: boolean;
  matchedBy: "EXPLICIT_EMPLOYEE" | "ROLE_FALLBACK" | "SUPER_ADMIN_OVERRIDE" | "NONE";
  reason?: string;
}

/**
 * Authoritative approver eligibility resolution helper for AHH WFM workflows.
 * 
 * Rules:
 * 1. Explicit Assignment Precedence: If ANY approver has employeeId populated, ONLY
 *    the user whose employeeId matches can approve. Role fallback is BYPASSED.
 * 2. Role Fallback: If employeeId is null/empty AND approverType is ROLE_BASED,
 *    users possessing the required role (via session.user.role or active UserRoleAssignment)
 *    are eligible within company boundary.
 * 3. Segregation of Duties (SoD): If creatorId is provided, creator cannot approve unless
 *    explicitly allowed.
 * 4. Company Boundary: Approver company must match instance company unless Super Admin.
 */
export async function isUserEligibleApprover(
  user: UserSessionContext,
  approvers: WorkflowApproverDefinition[],
  options?: {
    instanceCompanyId?: string | null;
    creatorId?: string | null;
    allowCreatorSelfApproval?: boolean;
    approvalRule?: string; // "ANY_ONE" | "ALL_REQUIRED"
  }
): Promise<ApproverEligibilityResult> {
  if (!user || !approvers || approvers.length === 0) {
    return { isEligible: false, isExplicit: false, matchedBy: "NONE", reason: "No approvers configured or user context missing" };
  }

  // 1. Company boundary check
  const isSuperAdmin = user.role === "SUPER_ADMIN";
  if (options?.instanceCompanyId && user.companyId && !isSuperAdmin) {
    if (user.companyId !== options.instanceCompanyId) {
      return { isEligible: false, isExplicit: false, matchedBy: "NONE", reason: "Company boundary violation" };
    }
  }

  // 2. Segregation of Duties (SoD) creator check
  if (options?.creatorId && !options.allowCreatorSelfApproval && !isSuperAdmin) {
    const isCreator = user.id === options.creatorId || (user.employeeId && user.employeeId === options.creatorId);
    if (isCreator) {
      // Check if user was explicitly named as self-approver
      const isExplicitSelf = approvers.some(ap => ap.approverType === "SPECIFIC_EMPLOYEE" && (
        (user.employeeId && ap.employeeId === user.employeeId) || ap.employeeId === user.id
      ));
      if (!isExplicitSelf) {
        return { isEligible: false, isExplicit: false, matchedBy: "NONE", reason: "Segregation of Duties: Creator cannot self-approve" };
      }
    }
  }

  // 3. Check for Explicit Employee Assignment across all approver records on this level
  const explicitApprovers = approvers.filter(ap => ap.approverType === "SPECIFIC_EMPLOYEE" && ap.employeeId && ap.employeeId.trim() !== "");
  if (explicitApprovers.length > 0) {
    // Explicit assignment takes absolute precedence. Role fallback is NOT evaluated.
    const hasEmployeeMatch = explicitApprovers.some(ap => (
      (user.employeeId && ap.employeeId === user.employeeId) ||
      ap.employeeId === user.id
    ));

    if (hasEmployeeMatch) {
      return { isEligible: true, isExplicit: true, matchedBy: "EXPLICIT_EMPLOYEE" };
    }

    return { isEligible: false, isExplicit: false, matchedBy: "NONE", reason: "Task explicitly assigned to other designated employee(s)" };
  }

  // 4. Role-based fallback evaluation (Only when NO explicit employee is assigned)
  const roleApprovers = approvers.filter(ap => ap.approverType === "ROLE_BASED" || (!ap.employeeId && ap.roleName));
  if (roleApprovers.length > 0) {
    const userRoles = new Set<string>();
    if (user.role) {
      userRoles.add(user.role.toUpperCase().replace(/\s+/g, "_"));
    }

    // Check DB-backed UserRoleAssignment if employeeId is available
    if (user.employeeId) {
      try {
        const assignments = await prisma.userRoleAssignment.findMany({
          where: { employeeId: user.employeeId, isActive: true }
        });
        if (assignments.length > 0) {
          const roleIds = assignments.map(a => a.roleId);
          const systemRoles = await prisma.systemRole.findMany({
            where: { id: { in: roleIds }, isActive: true }
          });
          systemRoles.forEach(r => userRoles.add(r.name.toUpperCase().replace(/\s+/g, "_")));
        }
      } catch (e) {
        // Fallback to session role if DB query fails
      }
    }

    const matchesRole = roleApprovers.some(ap => {
      if (!ap.roleName) return false;
      const targetRole = ap.roleName.toUpperCase().replace(/\s+/g, "_");
      return userRoles.has(targetRole);
    });

    if (matchesRole) {
      return { isEligible: true, isExplicit: false, matchedBy: "ROLE_FALLBACK" };
    }
  }

  // 5. Fallback for unconfigured level with no approvers (restricted to Admin)
  if (approvers.length === 0 && (user.role === "ADMIN" || isSuperAdmin)) {
    return { isEligible: true, isExplicit: false, matchedBy: "SUPER_ADMIN_OVERRIDE" };
  }

  return { isEligible: false, isExplicit: false, matchedBy: "NONE", reason: "User does not match configured level approvers" };
}
