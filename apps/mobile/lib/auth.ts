import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import AzureADProvider from "next-auth/providers/azure-ad";
import { mockDb } from "@ahh-wfm/mock-data";
import * as bcrypt from "bcryptjs";

export const MOBILE_SESSION_COOKIE_NAME = "ahh-wfm.mobile.session-token";
export const MOBILE_CALLBACK_COOKIE_NAME = "ahh-wfm.mobile.callback-url";
export const MOBILE_CSRF_COOKIE_NAME = "ahh-wfm.mobile.csrf-token";
export const MOBILE_SESSION_AUDIENCE = "ahh-wfm-mobile";

export function resolveNextAuthSecret(): string {
  const configured = process.env.NEXTAUTH_SECRET;
  if (configured && configured.trim().length > 0) {
    return configured.trim();
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "CRITICAL SECURITY ERROR: NEXTAUTH_SECRET environment variable must be explicitly configured in production."
    );
  }
  return "foundation-secret-key-12345";
}

// Hardcoded fallback grid for mobile reference
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
  ADMIN: [
    "dashboard.view", "employees.view", "employees.create", "employees.edit", "employees.bulkUpload",
    "attendance.view", "attendance.edit", "attendance.approveCorrection",
    "leaves.view", "leaves.approve", "shifts.view", "shifts.edit",
    "overtime.view", "overtime.approve", "reports.view", "reports.export",
    "sap.view", "sap.sync", "sap.mapping",
    "backup.view", "backup.create", "backup.download",
    "settings.view", "masters.view", "masters.manage",
    "users.view", "users.manage", "roles.view", "roles.manage", "audit.view",
    "manpower.view", "manpower.manage",
    "manpower.security.view", "manpower.security.manage", "manpower.security.reports.view", "manpower.security.reports.export",
    "manpower.fm.view", "manpower.fm.manage", "manpower.fm.reports.view", "manpower.fm.reports.export",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change",
    "settings.manage", "system.config.view", "system.config.manage", "masterdata.view", "masterdata.manage", "audit.export", "integration.view", "integration.manage"
  ],
  SYSTEM_ADMIN: [
    "settings.view", "settings.manage", "users.view", "users.manage", "roles.view", "roles.manage",
    "system.config.view", "system.config.manage", "masterdata.view", "masterdata.manage",
    "audit.view", "audit.export", "integration.view", "integration.manage",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  IT_ADMIN: [
    "settings.view", "settings.manage", "users.view", "users.manage", "roles.view", "roles.manage",
    "system.config.view", "system.config.manage", "audit.view", "integration.view", "integration.manage",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  APPLICATION_ADMIN: [
    "settings.view", "users.view", "users.manage", "roles.view", "roles.manage", "masterdata.view", "masterdata.manage",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  SETTINGS_ADMIN: [
    "settings.view", "settings.manage", "roles.view", "roles.manage",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  AUDIT_VIEWER: [
    "settings.view", "audit.view",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  EMPLOYEE_SELF_SERVICE: [
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  HR_MANAGER: [
    "dashboard.view", "employees.view", "employees.create", "employees.edit", "employees.bulkUpload",
    "attendance.view", "attendance.edit", "attendance.approveCorrection",
    "leaves.view", "leaves.approve", "shifts.view", "shifts.edit",
    "reports.view", "reports.export", "masters.view",
    "users.view", "users.manage", "roles.view", "roles.manage", "audit.view",
    "manpower.view", "manpower.manage",
    "manpower.security.view", "manpower.security.manage",
    "manpower.fm.view", "manpower.fm.manage",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  HR_EXECUTIVE: [
    "dashboard.view", "employees.view", "attendance.view", "leaves.view", "shifts.view",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  FINANCE_MANAGER: [
    "dashboard.view", "employees.view", "attendance.view", "overtime.view", "overtime.approve",
    "reports.view", "reports.export", "sap.view",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  FINANCE_VIEWER: [
    "dashboard.view", "reports.view", "sap.view",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  DEPARTMENT_MANAGER: [
    "dashboard.view", "employees.view", "attendance.view", "leaves.view", "shifts.view",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  SUPERVISOR: [
    "dashboard.view", "employees.view", "attendance.view", "attendance.approveCorrection",
    "leaves.view", "leaves.approve", "shifts.view", "overtime.view",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  EMPLOYEE: [
    "dashboard.view", "employees.view", "attendance.view", "leaves.view", "shifts.view",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  SAP_ADMIN: [
    "dashboard.view", "sap.view", "sap.sync", "sap.mapping", "reports.view",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
  REPORT_VIEWER: [
    "dashboard.view", "reports.view",
    "self.profile.view", "self.attendance.view", "self.attendance.punch", "self.leave.view", "self.leave.apply", "self.announcements.view", "self.password.change"
  ],
};

function getDefaultOperationAccess(defaultRole: string) {
  const normalizedRole = (defaultRole || "").trim().toUpperCase().replace(/\s+/g, "_");
  const defaultAllowSG =
    normalizedRole === "SUPER_ADMIN" ||
    normalizedRole === "ADMIN" ||
    normalizedRole === "OPERATIONS_MANAGER" ||
    normalizedRole === "OPERATIONS_COORDINATOR" ||
    normalizedRole === "PROJECT_SUPERVISOR" ||
    normalizedRole === "PATROLLING_SUPERVISOR" ||
    normalizedRole.startsWith("SECURITY_");
  const defaultAllowFM =
    normalizedRole === "SUPER_ADMIN" ||
    normalizedRole === "ADMIN" ||
    normalizedRole === "OPERATIONS_MANAGER" ||
    normalizedRole === "OPERATIONS_COORDINATOR" ||
    normalizedRole.startsWith("FM_");

  return {
    allowedWhiteCollar: true,
    allowedSecurityGuarding: defaultAllowSG,
    allowedFacilityManagement: defaultAllowFM,
    defaultLanding: "/dashboard",
    allowedCompanyIds: null
  };
}

export async function fetchUserRBAC(
  userId: string,
  defaultRole: string,
  options?: { throwOnError?: boolean }
) {
  try {
    const assignments = await mockDb.getUserRoleAssignments();
    const userAssignments = assignments.filter(a => a.employeeId === userId && a.isActive);
    const assignedRoleIds = userAssignments.map(a => a.roleId);

    const roles = await mockDb.getSystemRoles();
    
    const isSuperAdmin = defaultRole === "SUPER_ADMIN" || userAssignments.some(a => {
      const r = roles.find(x => x.id === a.roleId);
      return r && r.isActive !== false && r.name === "SUPER_ADMIN";
    });

    const isAdmin = defaultRole === "ADMIN" || userAssignments.some(a => {
      const r = roles.find(x => x.id === a.roleId);
      return r && r.isActive !== false && r.name === "ADMIN";
    });

    let permissions: string[] = [];

    if (isSuperAdmin) {
      permissions = [...DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN];
    } else if (isAdmin) {
      permissions = [...DEFAULT_ROLE_PERMISSIONS.ADMIN];
    } else {
      const allRolePermissions = await mockDb.getRolePermissions();
      const allPermissions = await mockDb.getSystemPermissions();

      const grantedPermIds = new Set<string>();
      const grantedPermKeys = new Set<string>();

      const normalizedDefaultRole = defaultRole.trim().toUpperCase().replace(/\s+/g, "_");
      const baseSystemRole = roles.find(
        r => r.isActive && r.name.trim().toUpperCase().replace(/\s+/g, "_") === normalizedDefaultRole
      );
      const hasConfiguredBaseRolePerms = baseSystemRole
        ? allRolePermissions.some(rp => rp.roleId === baseSystemRole.id)
        : false;
      const baseRoleGrantedPerms = baseSystemRole
        ? allRolePermissions.filter(
            rp =>
              rp.roleId === baseSystemRole.id &&
              (rp.canView || rp.canCreate || rp.canEdit || rp.canDelete || rp.canApprove || rp.canExport)
          )
        : [];

      if (hasConfiguredBaseRolePerms) {
        for (const rp of baseRoleGrantedPerms) {
          grantedPermIds.add(rp.permissionId);
        }
      } else {
        const baseRolePermKeys = DEFAULT_ROLE_PERMISSIONS[normalizedDefaultRole] || [];
        for (const pKey of baseRolePermKeys) {
          grantedPermKeys.add(pKey);
          const pObj = allPermissions.find(x => x.key === pKey);
          if (pObj) {
            grantedPermIds.add(pObj.id);
          }
        }
      }

      for (const asg of userAssignments) {
        const role = roles.find(r => r.id === asg.roleId);
        if (!role || !role.isActive) continue;

        const hasConfiguredRolePerms = allRolePermissions.some(rp => rp.roleId === asg.roleId);
        const rolePerms = allRolePermissions.filter(
          rp =>
            rp.roleId === asg.roleId &&
            (rp.canView || rp.canCreate || rp.canEdit || rp.canDelete || rp.canApprove || rp.canExport)
        );
        if (hasConfiguredRolePerms) {
          for (const rp of rolePerms) {
            grantedPermIds.add(rp.permissionId);
          }
        } else {
          const normalizedRoleName = role.name.trim().toUpperCase().replace(/\s+/g, "_");
          const defaultRolePerms = DEFAULT_ROLE_PERMISSIONS[normalizedRoleName] || [];
          for (const pKey of defaultRolePerms) {
            grantedPermKeys.add(pKey);
          }
        }
      }

      for (const p of allPermissions) {
        if (grantedPermIds.has(p.id)) {
          grantedPermKeys.add(p.key);
        }
      }
      permissions = Array.from(grantedPermKeys);

      if (permissions.length === 0 && !hasConfiguredBaseRolePerms && userAssignments.length === 0) {
        permissions = [...(DEFAULT_ROLE_PERMISSIONS[defaultRole.toUpperCase().replace(/\s+/g, "_")] || [])];
      }
    }

    let opAccess = await mockDb.getUserOperationAccess(userId);
    if (!opAccess) {
      opAccess = getDefaultOperationAccess(defaultRole);
    }

    return { permissions, operationAccess: opAccess, assignedRoleIds };
  } catch (e) {
    if (options?.throwOnError) {
      throw e;
    }
    console.error("Error loading user RBAC settings in mobile:", e);
    return {
      permissions: [...(DEFAULT_ROLE_PERMISSIONS[defaultRole.toUpperCase().replace(/\s+/g, "_")] || [])],
      operationAccess: getDefaultOperationAccess(defaultRole),
      assignedRoleIds: [] as string[]
    };
  }
}

export const authOptions: NextAuthOptions = {
  secret: resolveNextAuthSecret(),
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  cookies: {
    sessionToken: {
      name: MOBILE_SESSION_COOKIE_NAME,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NEXTAUTH_URL?.startsWith("https://") ?? false
      }
    },
    callbackUrl: {
      name: MOBILE_CALLBACK_COOKIE_NAME,
      options: {
        sameSite: "lax",
        path: "/",
        secure: process.env.NEXTAUTH_URL?.startsWith("https://") ?? false
      }
    },
    csrfToken: {
      name: MOBILE_CSRF_COOKIE_NAME,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NEXTAUTH_URL?.startsWith("https://") ?? false
      }
    }
  },
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID || "",
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET || "",
      tenantId: process.env.AZURE_AD_TENANT_ID || "",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const employees = await mockDb.getEmployees();
          const employee = employees.find(
            (e) => e.email.toLowerCase() === credentials.email.toLowerCase() || 
                   (e.username && e.username.toLowerCase() === credentials.email.toLowerCase())
          );

          if (employee) {
            if (
              employee.isActive === false ||
              (employee as any).employmentStatus === "INACTIVE" ||
              (employee as any).employmentStatus === "DELETED"
            ) {
              throw new Error("Your account is inactive. Please contact HR/Admin.");
            }

            if (employee.isLoginEnabled === false) {
              throw new Error("Account is disabled. Contact administrator.");
            }

            const isSelfServiceUser = employee.role?.toUpperCase() === "EMPLOYEE" || employee.role?.toUpperCase() === "EMPLOYEE_SELF_SERVICE";
            if (isSelfServiceUser && employee.selfServiceEnabled === false) {
              throw new Error("Self-service access is disabled. Please contact HR/Admin.");
            }

            if (employee.mobileAccessEnabled === false) {
              throw new Error("Your mobile access is disabled. Please contact HR/Admin.");
            }
            
            if (employee.isLocked) {
              throw new Error("Account is locked due to too many failed attempts.");
            }

            if (employee.authMode === "SSO") {
              throw new Error("Local login is disabled for this account. Please use SSO.");
            }

            if (employee.passwordHash) {
              const isPasswordValid = bcrypt.compareSync(credentials.password, employee.passwordHash);
              if (isPasswordValid) {
                await mockDb.updateEmployee(employee.id, {
                  failedLoginAttempts: 0,
                  lastLoginAt: new Date()
                } as any);

                const rbac = await fetchUserRBAC(employee.id, employee.role, { throwOnError: true });

                return {
                  id: employee.id,
                  employeeId: employee.id,
                  companyId: (employee as any).companyId || null,
                  departmentId: employee.departmentId || null,
                  allowedCompanyIds: Array.isArray((rbac.operationAccess as any)?.allowedCompanyIds)
                    ? (rbac.operationAccess as any).allowedCompanyIds
                    : null,
                  name: employee.name,
                  email: employee.email,
                  role: employee.role,
                  mustChangePassword: employee.mustChangePassword,
                  isActive: true,
                  isLoginEnabled: true,
                  isLocked: false,
                  webAccessEnabled: (employee as any).webAccessEnabled !== false,
                  mobileAccessEnabled: true,
                  authPlatform: "MOBILE",
                  aud: MOBILE_SESSION_AUDIENCE,
                  isRevoked: false,
                  authVerifyError: false,
                  image: employee.profilePhotoUrl || null,
                  profilePhotoUpdatedAt: employee.profilePhotoUpdatedAt ? new Date(employee.profilePhotoUpdatedAt).toISOString() : null,
                  permissions: rbac.permissions,
                  assignedRoleIds: rbac.assignedRoleIds,
                  operationAccess: rbac.operationAccess
                } as any;
              }
            }

            const newFailCount = (employee.failedLoginAttempts || 0) + 1;
            const isNowLocked = newFailCount >= 5;
            await mockDb.updateEmployee(employee.id, {
              failedLoginAttempts: newFailCount,
              isLocked: isNowLocked
            } as any);
            
            if (isNowLocked) {
              throw new Error("Account locked due to too many failed attempts.");
            } else {
              throw new Error("Invalid credentials");
            }
          }
        } catch (e: any) {
          console.error("Authorize error", e);
          throw new Error(e.message || "Invalid credentials");
        }
        return null;
      }
    })
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "azure-ad") {
        try {
          const employees = await mockDb.getEmployees();
          const employee = employees.find(
            (e) => e.email.toLowerCase() === user.email?.toLowerCase()
          );
          if (!employee) {
            return "/login?error=Your account is not registered. Please contact HR/Admin.";
          }
          if (
            employee.isActive === false ||
            (employee as any).employmentStatus === "INACTIVE" ||
            (employee as any).employmentStatus === "DELETED"
          ) {
            return "/login?error=Your account is inactive. Please contact HR/Admin.";
          }
          if (employee.isLoginEnabled === false) {
            return "/login?error=Your account is disabled. Please contact HR/Admin.";
          }
          if (employee.isLocked) {
            return "/login?error=Your account is locked. Please contact HR/Admin.";
          }
          if (employee.mobileAccessEnabled === false) {
            return "/login?error=Your mobile access is disabled. Please contact HR/Admin.";
          }
          if (employee.authMode === "LOCAL") {
            return "/login?error=SSO login is disabled for this account. Please use your credentials.";
          }
        } catch (e) {
          return "/login?error=Authentication failed";
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role || "EMPLOYEE";
        token.id = user.id;
        token.employeeId = (user as any).employeeId || user.id;
        token.companyId = (user as any).companyId || null;
        token.departmentId = (user as any).departmentId || null;
        token.allowedCompanyIds = (user as any).allowedCompanyIds || null;
        token.mustChangePassword = (user as any).mustChangePassword || false;
        token.isActive = (user as any).isActive !== false;
        token.isLoginEnabled = (user as any).isLoginEnabled !== false;
        token.isLocked = Boolean((user as any).isLocked);
        token.webAccessEnabled = (user as any).webAccessEnabled !== false;
        token.mobileAccessEnabled = (user as any).mobileAccessEnabled !== false;
        token.authPlatform = (user as any).authPlatform || "MOBILE";
        token.aud = (user as any).aud || MOBILE_SESSION_AUDIENCE;
        token.isRevoked = Boolean((user as any).isRevoked);
        token.authVerifyError = false;
        token.image = (user as any).image || null;
        token.profilePhotoUpdatedAt = (user as any).profilePhotoUpdatedAt || null;
        token.permissions = (user as any).permissions || [];
        token.assignedRoleIds = (user as any).assignedRoleIds || [];
        token.operationAccess = (user as any).operationAccess || null;
      } else {
        // Reject cross-platform tokens presented to Mobile
        if (
          (token.authPlatform && token.authPlatform !== "MOBILE") ||
          (token.aud && token.aud !== MOBILE_SESSION_AUDIENCE)
        ) {
          token.isRevoked = true;
          token.permissions = [];
          return token;
        }
      }

      const userId = token.id as string;
      if (userId) {
        try {
          const employees = await mockDb.getEmployees();
          const employee = employees.find((e) => e.id === userId);
          if (!employee) {
            token.isRevoked = true;
            token.isActive = false;
            token.isLoginEnabled = false;
            token.permissions = [];
            token.assignedRoleIds = [];
            token.authVerifyError = false;
            return token;
          }

          const isAccountDisabledOrLocked =
            employee.isActive === false ||
            (employee as any).employmentStatus === "INACTIVE" ||
            (employee as any).employmentStatus === "DELETED" ||
            employee.isLoginEnabled === false ||
            employee.isLocked === true ||
            employee.mobileAccessEnabled === false;

          token.role = employee.role;
          token.employeeId = employee.id;
          token.companyId = (employee as any).companyId || null;
          token.departmentId = employee.departmentId || null;
          token.mustChangePassword = employee.mustChangePassword || false;
          token.isActive =
            employee.isActive !== false &&
            (employee as any).employmentStatus !== "INACTIVE" &&
            (employee as any).employmentStatus !== "DELETED";
          token.isLoginEnabled = employee.isLoginEnabled !== false;
          token.isLocked = Boolean(employee.isLocked);
          token.webAccessEnabled = employee.webAccessEnabled !== false;
          token.mobileAccessEnabled = employee.mobileAccessEnabled !== false;
          token.authPlatform = "MOBILE";
          token.aud = MOBILE_SESSION_AUDIENCE;
          token.isRevoked = isAccountDisabledOrLocked;
          token.authVerifyError = false;
          token.image = employee.profilePhotoUrl || null;
          token.profilePhotoUpdatedAt = employee.profilePhotoUpdatedAt ? new Date(employee.profilePhotoUpdatedAt).toISOString() : null;
          
          if (isAccountDisabledOrLocked) {
            token.permissions = [];
            token.assignedRoleIds = [];
          } else {
            // Sync RBAC (fail closed on lookup error)
            const rbac = await fetchUserRBAC(employee.id, employee.role, { throwOnError: true });
            token.permissions = rbac.permissions;
            token.assignedRoleIds = rbac.assignedRoleIds;
            token.operationAccess = rbac.operationAccess;
            token.allowedCompanyIds = Array.isArray((rbac.operationAccess as any)?.allowedCompanyIds)
              ? (rbac.operationAccess as any).allowedCompanyIds
              : null;
          }
        } catch (e) {
          console.error("Error updating JWT token from DB:", e);
          token.authVerifyError = true;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
        (session.user as any).employeeId = token.employeeId || token.id;
        (session.user as any).companyId = token.companyId ?? null;
        (session.user as any).departmentId = token.departmentId ?? null;
        (session.user as any).allowedCompanyIds = token.allowedCompanyIds ?? null;
        (session.user as any).mustChangePassword = token.mustChangePassword;
        (session.user as any).isActive = token.isActive !== false;
        (session.user as any).isLoginEnabled = token.isLoginEnabled !== false;
        (session.user as any).isLocked = Boolean(token.isLocked);
        (session.user as any).webAccessEnabled = token.webAccessEnabled !== false;
        (session.user as any).mobileAccessEnabled = token.mobileAccessEnabled !== false;
        (session.user as any).authPlatform = token.authPlatform || "MOBILE";
        (session.user as any).aud = token.aud || MOBILE_SESSION_AUDIENCE;
        (session.user as any).isRevoked = Boolean(token.isRevoked);
        (session.user as any).authVerifyError = Boolean(token.authVerifyError);
        (session.user as any).permissions = token.permissions;
        (session.user as any).assignedRoleIds = token.assignedRoleIds || [];
        (session.user as any).operationAccess = token.operationAccess;
        session.user.image = (token.image as string) || null;
        (session.user as any).profilePhotoUpdatedAt = token.profilePhotoUpdatedAt;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
  }
};
