import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import AzureADProvider from "next-auth/providers/azure-ad";
import { prisma } from "@ahh-wfm/database";
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
          const employee = await prisma.employee.findUnique({
            where: { email: credentials.email.toLowerCase() }
          });

          if (employee && employee.passwordHash) {
            const isPasswordValid = bcrypt.compareSync(credentials.password, employee.passwordHash);
            if (isPasswordValid) {
              return {
                id: employee.id,
                name: employee.name,
                email: employee.email,
                role: employee.role,
              };
            }
          }
        } catch (e) {
          console.error("Authorize error", e);
        }
        return null;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role || "EMPLOYEE";
        token.id = user.id;
      } else if (token.email && !token.role) {
        try {
          const employee = await prisma.employee.findUnique({
            where: { email: token.email.toLowerCase() }
          });
          if (employee) {
            token.role = employee.role;
            token.id = employee.id;
          } else {
            token.role = "EMPLOYEE";
          }
        } catch (e) {
          token.role = "EMPLOYEE";
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
  }
};
