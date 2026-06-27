import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import AzureADProvider from "next-auth/providers/azure-ad";
import { mockDb } from "@ahh-wfm/mock-data";
import * as bcrypt from "bcryptjs";

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
          // We support login by either email or username
          const employee = employees.find(
            (e) => e.email.toLowerCase() === credentials.email.toLowerCase() || 
                   (e.username && e.username.toLowerCase() === credentials.email.toLowerCase())
          );

          if (employee) {
            // Check if active
            if (employee.isActive === false) {
              throw new Error("Your account is inactive. Please contact HR/Admin.");
            }

            // Check if login is enabled
            if (employee.isLoginEnabled === false) {
              throw new Error("Account is disabled. Contact administrator.");
            }

            // Check webAccessEnabled
            if (employee.webAccessEnabled === false) {
              throw new Error("Your web access is disabled. Please contact HR/Admin.");
            }
            
            // Check if locked
            if (employee.isLocked) {
              throw new Error("Account is locked due to too many failed attempts.");
            }

            // Check auth mode (LOCAL or LOCAL_AND_SSO only)
            if (employee.authMode === "SSO") {
              throw new Error("Local login is disabled for this account. Please use SSO.");
            }

            if (employee.passwordHash) {
              const isPasswordValid = bcrypt.compareSync(credentials.password, employee.passwordHash);
              if (isPasswordValid) {
                // Reset failed attempts and set last login
                await mockDb.updateEmployee(employee.id, {
                  failedLoginAttempts: 0,
                  lastLoginAt: new Date()
                } as any);

                return {
                  id: employee.id,
                  name: employee.name,
                  email: employee.email,
                  role: employee.role,
                  mustChangePassword: employee.mustChangePassword
                } as any;
              }
            }

            // If we reach here, password was invalid. Increment failed login attempts.
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
    async jwt({ token, user, account }) {
      if (user) {
        token.role = (user as any).role || "EMPLOYEE";
        token.id = user.id;
        token.mustChangePassword = (user as any).mustChangePassword || false;

        const email = user.email;
        if (email) {
          try {
            const employees = await mockDb.getEmployees();
            const employee = employees.find(
              (e) => e.email.toLowerCase() === email.toLowerCase()
            );
            if (employee) {
              token.id = employee.id;
              token.role = employee.role;
              token.email = employee.email;
              if ((employee as any).employeeCode) {
                token.employeeCode = (employee as any).employeeCode;
              }
              token.mustChangePassword = employee.mustChangePassword || false;
            } else {
              if (process.env.NODE_ENV === "development") {
                console.warn(`[Auth Warning] No Employee matched for signed-in email: ${email}`);
              }
            }
          } catch (e) {
            console.error("Error aligning auth session to employee:", e);
          }
        }
      }

      // Sync latest values from database on subsequent requests
      const userId = token.id as string;
      if (userId) {
        try {
          const employees = await mockDb.getEmployees();
          const employee = employees.find((e) => e.id === userId);
          if (employee) {
            token.role = employee.role;
            token.mustChangePassword = employee.mustChangePassword || false;
            token.email = employee.email;
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
