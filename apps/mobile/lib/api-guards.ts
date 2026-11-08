import { getServerSession } from "next-auth/next";
import { authOptions, fetchUserRBAC, MOBILE_SESSION_AUDIENCE } from "./auth";
import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";

// Replicate hasPermission locally in mobile app to avoid cross-app import issues
const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: [
    "dashboard.view", "employees.view", "employees.create", "employees.edit", "employees.delete", "employees.bulkUpload",
    "attendance.view", "attendance.edit", "attendance.approveCorrection",
    "leaves.view", "leaves.approve", "shifts.view", "shifts.edit",
    "overtime.view", "overtime.approve", "reports.view", "reports.export",
    "sap.view", "sap.sync", "sap.mapping",
    "backup.view", "backup.create", "backup.download", "backup.delete",
    "settings.view", "settings.roles.manage", "masters.view", "masters.manage",
    "users.view", "users.manage", "roles.view", "roles.manage", "audit.view",
    "manpower.view", "manpower.manage", "manpower.admin.full_access",
    "manpower.security.view", "manpower.security.manage", "manpower.security.reports.view", "manpower.security.reports.export",
    "manpower.fm.view", "manpower.fm.manage", "manpower.fm.reports.view", "manpower.fm.reports.export",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change",
    "settings.manage", "system.config.view", "system.config.manage", "masterdata.view", "masterdata.manage", "audit.export", "integration.view", "integration.manage"
  ],
  EMPLOYEE_SELF_SERVICE: [
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  EMPLOYEE: [
    "dashboard.view", "employees.view", "attendance.view", "leaves.view", "shifts.view",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ]
};

const MANPOWER_ADMIN_EXCLUDED_PREFIXES = [
  "users.",
  "roles.",
  "settings.",
  "system.",
  "backup.",
  "audit.",
  "integration.",
  "sap.",
  "employees.",
  "masters.",
  "masterdata.",
  "precontract."
];

function isScopeBlockedForPermission(user: any, permissionKey: string): boolean {
  const roleUpper = (user?.role || "").trim().toUpperCase().replace(/\s+/g, "_");
  const opAccess = user?.operationAccess;
  const isOpArray = Array.isArray(opAccess);
  const arrayHasAll = isOpArray && opAccess.includes("ALL");
  const arrayAllowsSG = isOpArray ? arrayHasAll || opAccess.includes("SECURITY_GUARDING") : undefined;
  const arrayAllowsFM = isOpArray ? arrayHasAll || opAccess.includes("FACILITY_MANAGEMENT") : undefined;
  const disallowSG =
    roleUpper.startsWith("FM_") ||
    (isOpArray ? !arrayAllowsSG : opAccess?.allowedSecurityGuarding === false);
  const disallowFM =
    roleUpper.startsWith("SECURITY_") ||
    (isOpArray ? !arrayAllowsFM : opAccess?.allowedFacilityManagement === false);

  if (permissionKey === "manpower.admin.full_access") {
    if (disallowSG || disallowFM) {
      return true;
    }
  }

  const isSecurityOnlyKey =
    permissionKey.startsWith("manpower.security.") ||
    permissionKey.startsWith("security.") ||
    permissionKey.startsWith("secfac.postOrders.") ||
    permissionKey.startsWith("secfac.briefings.") ||
    permissionKey.startsWith("secfac.incidents.") ||
    permissionKey.startsWith("secfac.inspections.");

  if (isSecurityOnlyKey && disallowSG) {
    return true;
  }

  const isFacilityOnlyKey =
    permissionKey.startsWith("manpower.fm.") ||
    permissionKey.startsWith("manpower.facility.") ||
    permissionKey.startsWith("facility.");

  if (isFacilityOnlyKey && disallowFM) {
    return true;
  }

  return false;
}

function isManpowerAdminWildcardAllowed(
  user: {
    role?: string;
    operationAccess?: any;
  },
  permissionKey: string
): boolean {
  if (MANPOWER_ADMIN_EXCLUDED_PREFIXES.some((prefix) => permissionKey.startsWith(prefix))) {
    return false;
  }

  const isManpowerScopedKey =
    permissionKey.startsWith("manpower.") ||
    permissionKey.startsWith("secfac.") ||
    permissionKey.startsWith("security.") ||
    permissionKey.startsWith("facility.") ||
    permissionKey.startsWith("commercial.commandCenter.");

  if (!isManpowerScopedKey) {
    return false;
  }

  if (isScopeBlockedForPermission(user, permissionKey)) {
    return false;
  }

  return true;
}

export function isAdminUser(user: { role?: string } | null | undefined): boolean {
  if (!user || !user.role) return false;
  const role = user.role.toUpperCase().replace(/\s+/g, "_");
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function hasPermission(
  user: {
    role?: string;
    permissions?: string[];
    operationAccess?: any;
  } | null | undefined,
  permissionKey: string
): boolean {
  if (!user) return false;
  if (isAdminUser(user)) {
    return true;
  }
  if (isScopeBlockedForPermission(user, permissionKey)) {
    return false;
  }
  const roleUpper = user.role?.toUpperCase().replace(/\s+/g, "_") || "";
  if (user.permissions && Array.isArray(user.permissions)) {
    if (user.permissions.includes(permissionKey)) return true;
    if (
      user.permissions.includes("manpower.admin.full_access") &&
      isManpowerAdminWildcardAllowed(user, permissionKey)
    ) {
      return true;
    }
    return false;
  }
  const permissions = DEFAULT_ROLE_PERMISSIONS[roleUpper] || [];
  if (permissions.includes(permissionKey)) return true;
  if (
    permissions.includes("manpower.admin.full_access") &&
    isManpowerAdminWildcardAllowed(user, permissionKey)
  ) {
    return true;
  }
  return false;
}

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

  if (!targetCompanyId || typeof targetCompanyId !== "string" || targetCompanyId.trim().length === 0) {
    return false;
  }

  const authorizedCompanies = getAuthorizedCompanyIds(user);
  if (authorizedCompanies === null) return true;

  if (authorizedCompanies.length === 0) {
    return false;
  }

  return authorizedCompanies.includes(targetCompanyId.trim());
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
    user.mobileAccessEnabled === false ||
    user.authPlatform === "WEB" ||
    (user.aud && user.aud !== MOBILE_SESSION_AUDIENCE)
  ) {
    return {
      error: NextResponse.json(
        { error: "Forbidden: Mobile access is disabled for this account" },
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

    if (liveEmployee.mobileAccessEnabled === false) {
      return {
        error: NextResponse.json(
          { error: "Forbidden: Mobile access is disabled for this account" },
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
  }

  // 4. Validate Operation Scope (Applies to everyone, except Admin/Super Admin who have global bypass)
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

  // 5. Validate Company Scope (if targetCompanyId or requireCompanyContext is specified)
  if ((options?.targetCompanyId || options?.requireCompanyContext) && !isAdmin) {
    if (!canAccessCompany(user, options.targetCompanyId, { requireCompanyContext: options.requireCompanyContext })) {
      return {
        error: NextResponse.json({ error: "Forbidden: Cross-company access denied" }, { status: 403 }),
        session: null
      };
    }
  }

  // 6. Validate Self Service Only (to make sure employee-only user cannot access other employees' data)
  const isSelfServiceOnly = userRole?.toUpperCase().replace(/\s+/g, "_") === "EMPLOYEE_SELF_SERVICE" || 
                            userRole?.toUpperCase().replace(/\s+/g, "_") === "EMPLOYEE" || 
                            (!isAdmin && !userPermissions.some((p: string) => !p.startsWith("self.") && p !== "dashboard.view"));
  
  if (isSelfServiceOnly) {
    if (options?.employeeIdParam && user.id !== options.employeeIdParam) {
      return { error: NextResponse.json({ error: "Forbidden: Self-service users can only access their own data" }, { status: 403 }), session: null };
    }
  }

  return { error: null, session: { ...session, user: { ...user, isSelfServiceOnly } } };
}
