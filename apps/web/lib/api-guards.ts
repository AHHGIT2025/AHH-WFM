import { getServerSession } from "next-auth/next";
import { authOptions, fetchUserRBAC, WEB_SESSION_AUDIENCE } from "./auth";
import { NextResponse } from "next/server";
import { hasPermission, isAdminUser } from "./permissions";
export { hasPermission, isAdminUser };
import { mockDb } from "@ahh-wfm/mock-data";

export function getAuthorizedCompanyIds(user: any): string[] | null {
  if (!user) return [];
  if (isAdminUser(user)) return null;

  const allowed = new Set<string>();
  if (typeof user.companyId === "string" && user.companyId.trim().length > 0) {
    allowed.add(user.companyId.trim());
  }
  const topLevelAllowed = Array.isArray(user.allowedCompanyIds) ? user.allowedCompanyIds : [];
  for (const cid of topLevelAllowed) {
    if (typeof cid === "string" && cid.trim().length > 0) {
      allowed.add(cid.trim());
    }
  }
  const opAllowed = Array.isArray(user.operationAccess?.allowedCompanyIds)
    ? user.operationAccess.allowedCompanyIds
    : [];
  for (const cid of opAllowed) {
    if (typeof cid === "string" && cid.trim().length > 0) {
      allowed.add(cid.trim());
    }
  }

  return Array.from(allowed);
}

export function canAccessCompany(
  user: any,
  targetCompanyId: string | null | undefined,
  options?: { crossCompanyPermission?: string; requireCompanyContext?: boolean }
): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  if (options?.crossCompanyPermission && hasPermission(user, options.crossCompanyPermission)) {
    return true;
  }

  // Deny-by-default for non-admin users when targetCompanyId is missing, null, or empty
  if (!targetCompanyId || typeof targetCompanyId !== "string" || targetCompanyId.trim().length === 0) {
    return false;
  }

  const authorizedCompanies = getAuthorizedCompanyIds(user);
  if (authorizedCompanies === null) return true;

  // Deny-by-default when a non-admin user has no company assignment
  if (authorizedCompanies.length === 0) {
    return false;
  }

  return authorizedCompanies.includes(targetCompanyId.trim());
}

export function resolveAuthorizedCompanyFilter(
  user: any,
  requestedCompanyId?: string | null,
  options?: { crossCompanyPermission?: string; requireCompanyContext?: boolean }
): { error: NextResponse | null; companyId?: string; companyIds?: string[] | null } {
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (isAdminUser(user) || (options?.crossCompanyPermission && hasPermission(user, options.crossCompanyPermission))) {
    return {
      error: null,
      companyId: requestedCompanyId && requestedCompanyId.trim() ? requestedCompanyId.trim() : undefined,
      companyIds: null
    };
  }

  const authorizedCompanies = getAuthorizedCompanyIds(user) || [];
  if (requestedCompanyId && requestedCompanyId.trim().length > 0) {
    if (!canAccessCompany(user, requestedCompanyId, options)) {
      return {
        error: NextResponse.json(
          { error: "Forbidden: Cross-company access denied" },
          { status: 403 }
        )
      };
    }
    return { error: null, companyId: requestedCompanyId.trim(), companyIds: authorizedCompanies };
  }

  if (authorizedCompanies.length === 0) {
    return {
      error: NextResponse.json(
        { error: "Forbidden: User account has no assigned company scope" },
        { status: 403 }
      )
    };
  }

  return {
    error: null,
    companyId: authorizedCompanies.length === 1 ? authorizedCompanies[0] : undefined,
    companyIds: authorizedCompanies
  };
}

export async function checkApiAuth(
  allowedRoles?: string[],
  options?: {
    requiredPermission?: string;
    requiredOperation?: "WHITE_COLLAR" | "SECURITY_GUARDING" | "FACILITY_MANAGEMENT" | ("WHITE_COLLAR" | "SECURITY_GUARDING" | "FACILITY_MANAGEMENT")[];
    employeeIdParam?: string; // if passed, restricts self-service users to their own ID
    targetCompanyId?: string | null;
    requireCompanyContext?: boolean;
  }
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null };
  }
  
  const user = session.user as any;

  if (user.authVerifyError === true) {
    return {
      error: NextResponse.json(
        { error: "Service unavailable: Unable to verify live account authorization" },
        { status: 503 }
      ),
      session: null
    };
  }

  // Immediate session revocation / lock / platform check from session claims
  if (
    user.isRevoked === true ||
    user.isLocked === true ||
    user.isActive === false ||
    user.isLoginEnabled === false
  ) {
    return {
      error: NextResponse.json(
        { error: "Session revoked: Account is locked, inactive, or disabled" },
        { status: 401 }
      ),
      session: null
    };
  }

  if (
    user.webAccessEnabled === false ||
    user.authPlatform === "MOBILE" ||
    (user.aud && user.aud !== WEB_SESSION_AUDIENCE)
  ) {
    return {
      error: NextResponse.json(
        { error: "Forbidden: Web access is disabled for this account" },
        { status: 403 }
      ),
      session: null
    };
  }

  if (!user.id) {
    return {
      error: NextResponse.json(
        { error: "Session revoked: Employee account not found" },
        { status: 401 }
      ),
      session: null
    };
  }

  // Live employee status & RBAC verification (fail-closed: never allow protected operations on stale JWT claims)
  try {
    const employees = await mockDb.getEmployees();
    const userIdNorm = String(user.id).toLowerCase();
    const liveEmployee = Array.isArray(employees)
      ? employees.find(
          (e: any) =>
            e.id === user.id || (typeof e.id === "string" && e.id.toLowerCase() === userIdNorm)
        )
      : undefined;

    if (!liveEmployee) {
      return {
        error: NextResponse.json(
          { error: "Session revoked: Employee account not found" },
          { status: 401 }
        ),
        session: null
      };
    }

    if (
      liveEmployee.isActive === false ||
      (liveEmployee as any).employmentStatus === "INACTIVE" ||
      (liveEmployee as any).employmentStatus === "DELETED" ||
      liveEmployee.isLoginEnabled === false ||
      liveEmployee.isLocked === true
    ) {
      return {
        error: NextResponse.json(
          { error: "Session revoked: Account is locked, inactive, or disabled" },
          { status: 401 }
        ),
        session: null
      };
    }

    if (liveEmployee.webAccessEnabled === false) {
      return {
        error: NextResponse.json(
          { error: "Forbidden: Web access is disabled for this account" },
          { status: 403 }
        ),
        session: null
      };
    }

    if (user.companyId === undefined) {
      user.companyId = (liveEmployee as any).companyId || null;
    }
    if (user.employeeId === undefined) {
      user.employeeId = liveEmployee.id;
    }
    if (user.departmentId === undefined) {
      user.departmentId = liveEmployee.departmentId || null;
    }

    const assignments = await mockDb.getUserRoleAssignments();
    const hasUserRoleAssignments =
      Array.isArray(assignments) &&
      assignments.some(
        (a: any) =>
          a.employeeId === liveEmployee.id ||
          (typeof a.employeeId === "string" && a.employeeId.toLowerCase() === userIdNorm)
      );

    if (Array.isArray(user.assignedRoleIds) || hasUserRoleAssignments) {
      const liveRbac = await fetchUserRBAC(liveEmployee.id, liveEmployee.role || user.role, {
        throwOnError: true
      });
      user.role = liveEmployee.role || user.role;
      user.permissions = liveRbac.permissions;
      user.assignedRoleIds = liveRbac.assignedRoleIds;
      if (liveRbac.operationAccess) {
        user.operationAccess = liveRbac.operationAccess;
      }
    }
  } catch {
    return {
      error: NextResponse.json(
        { error: "Service unavailable: Unable to verify live account authorization" },
        { status: 503 }
      ),
      session: null
    };
  }

  const userRole = user.role;
  const userPermissions = user.permissions || [];
  const operationAccess = user.operationAccess || {};

  // Safe server-side console logs behind debug/dev flags
  if (process.env.NODE_ENV !== "production" || process.env.DEBUG === "true") {
    console.log(`[API Auth Debug] user=${user.id}, role=${userRole}, permissionsCount=${userPermissions.length}, operationAccess=${JSON.stringify(operationAccess)}`);
  }

  const isAdmin = isAdminUser(user);

  // 1. Check Admin Override (Admin and Super Admin bypass permission/role checks)
  if (!isAdmin) {
    // 2. Validate Roles (if specified)
    if (allowedRoles && !allowedRoles.includes(userRole)) {
      return { error: NextResponse.json({ error: "Forbidden: Role restricted" }, { status: 403 }), session: null };
    }

    // 3. Validate Required Permission (if specified)
    if (options?.requiredPermission) {
      if (!hasPermission(user, options.requiredPermission)) {
        return { error: NextResponse.json({ error: `Forbidden: Requires permission ${options.requiredPermission}` }, { status: 403 }), session: null };
      }
    }

    // 4. Validate IT/Admin restriction
    // If the API requires admin/settings actions, only allow if user has settings/users/roles manage permissions
    const isOnlyAdminRoles = allowedRoles && allowedRoles.length > 0 && allowedRoles.every(r => ["ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "IT_ADMIN", "SETTINGS_ADMIN"].includes(r));
    const requiresAdmin = isOnlyAdminRoles || options?.requiredPermission?.startsWith("settings.") || options?.requiredPermission?.startsWith("users.") || options?.requiredPermission?.startsWith("roles.");
    if (requiresAdmin) {
      const isItAdminRole = ["SUPER_ADMIN", "SYSTEM_ADMIN", "IT_ADMIN", "APPLICATION_ADMIN", "SETTINGS_ADMIN"].includes(userRole?.toUpperCase());
      const hasSystemManage = userPermissions.some((p: string) => p.startsWith("settings.") || p.startsWith("users.") || p.startsWith("roles.") || p.startsWith("system."));
      if (!isItAdminRole && !hasSystemManage) {
        return { error: NextResponse.json({ error: "Forbidden: IT/Admin access required" }, { status: 403 }), session: null };
      }
    }
  }

  // 5. Validate Operation Scope (Applies to everyone, except Admin/Super Admin who have global bypass)
  if (options?.requiredOperation && !isAdmin) {
    const requiredOps = Array.isArray(options.requiredOperation) ? options.requiredOperation : [options.requiredOperation];
    const normalizedRole = (userRole || "").trim().toUpperCase().replace(/\s+/g, "_");
    const isFmRole = normalizedRole.startsWith("FM_");
    const isSgRole = normalizedRole.startsWith("SECURITY_");

    const allowSG =
      typeof operationAccess.allowedSecurityGuarding === "boolean"
        ? operationAccess.allowedSecurityGuarding && !isFmRole
        : !isFmRole &&
          (isSgRole ||
            normalizedRole === "OPERATIONS_MANAGER" ||
            normalizedRole === "OPERATIONS_COORDINATOR" ||
            normalizedRole === "PROJECT_SUPERVISOR" ||
            normalizedRole === "PATROLLING_SUPERVISOR" ||
            userPermissions.some((p: string) => p.startsWith("manpower.security.") || p.startsWith("secfac.")));

    const allowFM =
      typeof operationAccess.allowedFacilityManagement === "boolean"
        ? operationAccess.allowedFacilityManagement && !isSgRole
        : !isSgRole &&
          (isFmRole ||
            normalizedRole === "OPERATIONS_MANAGER" ||
            normalizedRole === "OPERATIONS_COORDINATOR" ||
            userPermissions.some((p: string) => p.startsWith("manpower.fm.") || p.startsWith("manpower.facility.")));

    let hasOpAccess = false;
    if (requiredOps.includes("WHITE_COLLAR") && operationAccess.allowedWhiteCollar !== false) hasOpAccess = true;
    if (requiredOps.includes("SECURITY_GUARDING") && allowSG) hasOpAccess = true;
    if (requiredOps.includes("FACILITY_MANAGEMENT") && allowFM) hasOpAccess = true;

    if (!hasOpAccess) {
      return { error: NextResponse.json({ error: "Forbidden: Restricted operation scope" }, { status: 403 }), session: null };
    }
  }

  // 6. Validate Company Scope (if targetCompanyId or requireCompanyContext is specified)
  if ((options?.targetCompanyId || options?.requireCompanyContext) && !isAdmin) {
    if (!canAccessCompany(user, options.targetCompanyId, { requireCompanyContext: options.requireCompanyContext })) {
      return {
        error: NextResponse.json({ error: "Forbidden: Cross-company access denied" }, { status: 403 }),
        session: null
      };
    }
  }

  // 7. Validate Self Service Only (to make sure employee-only user cannot access other employees' data)
  const isSelfServiceOnly = userRole?.toUpperCase().replace(/\s+/g, "_") === "EMPLOYEE_SELF_SERVICE" || 
                            userRole?.toUpperCase().replace(/\s+/g, "_") === "EMPLOYEE" || 
                            (!isAdmin && !userPermissions.some((p: string) => !p.startsWith("self.") && p !== "dashboard.view"));
  
  if (isSelfServiceOnly) {
    // If self-service user tries to query another employee's ID:
    if (options?.employeeIdParam && user.id !== options.employeeIdParam) {
      return { error: NextResponse.json({ error: "Forbidden: Self-service users can only access their own data" }, { status: 403 }), session: null };
    }
  }

  return { error: null, session: { ...session, user: { ...user, isSelfServiceOnly } } };
}
