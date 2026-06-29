import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import AzureADProvider from "next-auth/providers/azure-ad";
import { mockDb } from "@ahh-wfm/mock-data";
import * as bcrypt from "bcryptjs";
import { DEFAULT_ROLE_PERMISSIONS } from "./permissions";

async function fetchUserRBAC(userId: string, defaultRole: string) {
  try {
    // 1. Fetch user role assignments
    const assignments = await mockDb.getUserRoleAssignments();
    const userAssignments = assignments.filter(a => a.employeeId === userId && a.isActive);

    // 2. Fetch all system roles to find their name & active status
    const roles = await mockDb.getSystemRoles();
    
    // Check if the user is a super admin
    const isSuperAdmin = defaultRole === "SUPER_ADMIN" || userAssignments.some(a => {
      const r = roles.find(x => x.id === a.roleId);
      return r && r.name === "SUPER_ADMIN";
    });

    let permissions: string[] = [];

    if (isSuperAdmin) {
      permissions = [...DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN];
    } else {
      // Fetch role permissions
      const allRolePermissions = await mockDb.getRolePermissions();
      const allPermissions = await mockDb.getSystemPermissions();

      const grantedPermIds = new Set<string>();
      for (const asg of userAssignments) {
        const role = roles.find(r => r.id === asg.roleId);
        if (!role || !role.isActive) continue; // Inactive roles do not contribute permissions

        const rolePerms = allRolePermissions.filter(rp => rp.roleId === asg.roleId);
        for (const rp of rolePerms) {
          // If any capability is checked
          if (rp.canView || rp.canCreate || rp.canEdit || rp.canDelete || rp.canApprove || rp.canExport) {
            grantedPermIds.add(rp.permissionId);
          }
        }
      }

      // Map permission IDs to keys
      permissions = allPermissions
        .filter(p => grantedPermIds.has(p.id))
        .map(p => p.key);

      // If the user has no custom permissions mapped, fall back to the default role's hardcoded permissions!
      if (permissions.length === 0) {
        permissions = [...(DEFAULT_ROLE_PERMISSIONS[defaultRole.toUpperCase().replace(/\s+/g, "_")] || [])];
      }
    }

    // 3. Fetch operation access
    let opAccess = await mockDb.getUserOperationAccess(userId);
    if (!opAccess) {
      // Default fallback
      opAccess = {
        allowedWhiteCollar: true,
        allowedSecurityGuarding: defaultRole === "SUPER_ADMIN" || defaultRole === "ADMIN",
        allowedFacilityManagement: defaultRole === "SUPER_ADMIN" || defaultRole === "ADMIN",
        defaultLanding: "/dashboard",
        allowedCompanyIds: null
      };
    }

    return { permissions, operationAccess: opAccess };
  } catch (e) {
    console.error("Error loading user RBAC settings:", e);
    // Safe fallbacks on failure
    return {
      permissions: [...(DEFAULT_ROLE_PERMISSIONS[defaultRole.toUpperCase().replace(/\s+/g, "_")] || [])],
      operationAccess: {
        allowedWhiteCollar: true,
        allowedSecurityGuarding: defaultRole === "SUPER_ADMIN" || defaultRole === "ADMIN",
        allowedFacilityManagement: defaultRole === "SUPER_ADMIN" || defaultRole === "ADMIN",
        defaultLanding: "/dashboard",
        allowedCompanyIds: null
      }
    };
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || "foundation-secret-key-12345",
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
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
            if (employee.isActive === false) {
              throw new Error("Your account is inactive. Please contact HR/Admin.");
            }

            if (employee.isLoginEnabled === false) {
              throw new Error("Account is disabled. Contact administrator.");
            }

            if (employee.webAccessEnabled === false) {
              throw new Error("Your web access is disabled. Please contact HR/Admin.");
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

                const rbac = await fetchUserRBAC(employee.id, employee.role);

                return {
                  id: employee.id,
                  name: employee.name,
                  email: employee.email,
                  role: employee.role,
                  mustChangePassword: employee.mustChangePassword,
                  image: employee.profilePhotoUrl || null,
                  profilePhotoUpdatedAt: employee.profilePhotoUpdatedAt ? new Date(employee.profilePhotoUpdatedAt).toISOString() : null,
                  permissions: rbac.permissions,
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
          if (employee.isActive === false) {
            return "/login?error=Your account is inactive. Please contact HR/Admin.";
          }
          if (employee.webAccessEnabled === false) {
            return "/login?error=Your web access is disabled. Please contact HR/Admin.";
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
        token.mustChangePassword = (user as any).mustChangePassword || false;
        token.image = (user as any).image || null;
        token.profilePhotoUpdatedAt = (user as any).profilePhotoUpdatedAt || null;
        token.permissions = (user as any).permissions || [];
        token.operationAccess = (user as any).operationAccess || null;
      }

      const userId = token.id as string;
      if (userId) {
        try {
          const employees = await mockDb.getEmployees();
          const employee = employees.find((e) => e.id === userId);
          if (employee) {
            token.role = employee.role;
            token.mustChangePassword = employee.mustChangePassword || false;
            token.email = employee.email;
            token.image = employee.profilePhotoUrl || null;
            token.profilePhotoUpdatedAt = employee.profilePhotoUpdatedAt ? new Date(employee.profilePhotoUpdatedAt).toISOString() : null;
            
            // Sync RBAC
            const rbac = await fetchUserRBAC(employee.id, employee.role);
            token.permissions = rbac.permissions;
            token.operationAccess = rbac.operationAccess;

            if ((employee as any).employeeCode) {
              token.employeeCode = (employee as any).employeeCode;
            }
          }
        } catch (e) {
          console.error("Error updating JWT token from DB:", e);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
        (session.user as any).mustChangePassword = token.mustChangePassword;
        (session.user as any).permissions = token.permissions;
        (session.user as any).operationAccess = token.operationAccess;
        session.user.image = (token.image as string) || null;
        (session.user as any).profilePhotoUpdatedAt = token.profilePhotoUpdatedAt;
        if (token.employeeCode) {
          (session.user as any).employeeCode = token.employeeCode;
        }
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
  }
};
