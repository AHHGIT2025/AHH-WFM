import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth";
import { NextResponse } from "next/server";
import { hasPermission } from "./permissions";

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

    // 4. Validate IT/Admin restriction
    // If the API requires admin/settings actions, only allow if user has settings/users/roles manage permissions
    const requiresAdmin = allowedRoles?.includes("ADMIN") || options?.requiredPermission?.startsWith("settings.") || options?.requiredPermission?.startsWith("users.") || options?.requiredPermission?.startsWith("roles.");
    if (requiresAdmin) {
      const isItAdminRole = ["SUPER_ADMIN", "SYSTEM_ADMIN", "IT_ADMIN", "APPLICATION_ADMIN", "SETTINGS_ADMIN"].includes(userRole?.toUpperCase());
      const hasSystemManage = userPermissions.some((p: string) => p.startsWith("settings.") || p.startsWith("users.") || p.startsWith("roles.") || p.startsWith("system."));
      if (!isItAdminRole && !hasSystemManage) {
        return { error: NextResponse.json({ error: "Forbidden: IT/Admin access required" }, { status: 403 }), session: null };
      }
    }
  }

  // 5. Validate Operation Scope (Applies to everyone, except Super Admin who has global bypass)
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

  // 6. Validate Self Service Only (to make sure employee-only user cannot access other employees' data)
  const isSelfServiceOnly = userRole?.toUpperCase().replace(/\s+/g, "_") === "EMPLOYEE_SELF_SERVICE" || 
                            userRole?.toUpperCase().replace(/\s+/g, "_") === "EMPLOYEE" || 
                            (!isSuperAdmin && !userPermissions.some((p: string) => !p.startsWith("self.") && p !== "dashboard.view"));
  
  if (isSelfServiceOnly) {
    // If self-service user tries to query another employee's ID:
    if (options?.employeeIdParam && user.id !== options.employeeIdParam) {
      return { error: NextResponse.json({ error: "Forbidden: Self-service users can only access their own data" }, { status: 403 }), session: null };
    }
  }

  return { error: null, session: { ...session, user: { ...user, isSelfServiceOnly } } };
}
