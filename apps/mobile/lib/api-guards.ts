import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth";
import { NextResponse } from "next/server";

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

function hasPermission(user: { role?: string; permissions?: string[] } | null | undefined, permissionKey: string): boolean {
  if (!user) return false;
  const roleUpper = user.role?.toUpperCase().replace(/\s+/g, "_") || "";
  if (roleUpper === "SUPER_ADMIN") {
    return true;
  }
  if (user.permissions && Array.isArray(user.permissions)) {
    if (user.permissions.includes("manpower.admin.full_access")) return true;
    return user.permissions.includes(permissionKey);
  }
  const permissions = DEFAULT_ROLE_PERMISSIONS[roleUpper] || [];
  return permissions.includes(permissionKey);
}

export async function checkApiAuth(
  allowedRoles?: string[],
  options?: {
    requiredPermission?: string;
    requiredOperation?: "WHITE_COLLAR" | "SECURITY_GUARDING" | "FACILITY_MANAGEMENT" | ("WHITE_COLLAR" | "SECURITY_GUARDING" | "FACILITY_MANAGEMENT")[];
    employeeIdParam?: string; // if passed, restricts self-service users to their own ID
  }
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null };
  }
  
  const user = session.user as any;
  const userRole = user.role;
  const userPermissions = user.permissions || [];
  const operationAccess = user.operationAccess || {};

  const isSuperAdmin = userRole?.toUpperCase().replace(/\s+/g, "_") === "SUPER_ADMIN";

  // 1. Check Super Admin Override (Super Admin bypasses permission/role checks)
  if (!isSuperAdmin) {
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

  // 4. Validate Operation Scope (Applies to everyone, except Super Admin who has global bypass)
  if (options?.requiredOperation && !isSuperAdmin) {
    const requiredOps = Array.isArray(options.requiredOperation) ? options.requiredOperation : [options.requiredOperation];
    
    let hasOpAccess = false;
    if (requiredOps.includes("WHITE_COLLAR") && operationAccess.allowedWhiteCollar !== false) hasOpAccess = true;
    if (requiredOps.includes("SECURITY_GUARDING") && operationAccess.allowedSecurityGuarding === true) hasOpAccess = true;
    if (requiredOps.includes("FACILITY_MANAGEMENT") && operationAccess.allowedFacilityManagement === true) hasOpAccess = true;

    if (!hasOpAccess) {
      return { error: NextResponse.json({ error: "Forbidden: Restricted operation scope" }, { status: 403 }), session: null };
    }
  }

  // 5. Validate Self Service Only (to make sure employee-only user cannot access other employees' data)
  const isSelfServiceOnly = userRole?.toUpperCase().replace(/\s+/g, "_") === "EMPLOYEE_SELF_SERVICE" || 
                            userRole?.toUpperCase().replace(/\s+/g, "_") === "EMPLOYEE" || 
                            (!isSuperAdmin && !userPermissions.some((p: string) => !p.startsWith("self.") && p !== "dashboard.view"));
  
  if (isSelfServiceOnly) {
    if (options?.employeeIdParam && user.id !== options.employeeIdParam) {
      return { error: NextResponse.json({ error: "Forbidden: Self-service users can only access their own data" }, { status: 403 }), session: null };
    }
  }

  return { error: null, session: { ...session, user: { ...user, isSelfServiceOnly } } };
}
