# AHH WFM - Authentication & Security Roadmap

This document outlines the authentication design plan to secure the **AHH WFM** monorepo application.

---

## 1. Authentication Framework Selection

We recommend integrating **NextAuth.js** (Auth.js) as the authentication layer:
- **Workspace Support:** Integrates with Next.js App Router.
- **Provider Flexibility:** Supports credentials-based logins (email/password) as well as Corporate SSO providers (like Active Directory, Auth0, or SAML).
- **Prisma Integration:** Provides a native Prisma adapter (`@next-auth/prisma-adapter`) to manage user sessions and login history directly in your MySQL database.

---

## 2. User Roles & Access Control (RBAC)

The system will enforce three primary user roles:

| Role | Access Scope | Allowed Apps | Permissions |
| :--- | :--- | :---: | :--- |
| **`Admin`** | System Control | Web App | Full write permissions, CRUD operations on mappings, database seeding. |
| **`Supervisor`** | Manager Console | Web App | Read-only access to SAP sync mappings; approve/reject leave requests. |
| **`Employee`** | Operative Portal | Mobile App | Perform check-in/out geo-attendance logging, submit leave requests. |

---

## 3. Implementation Steps

### Phase 1: Dependency Installation & Schema Update
1. Install NextAuth dependencies:
   ```bash
   npm install next-auth @next-auth/prisma-adapter bcryptjs
   npm install --save-dev @types/bcryptjs
   ```
2. Update the Prisma schema to add security columns to the `Employee` model:
   - `passwordHash` (String)
   - `role` (String) - Defaults to `"Employee"`.

### Phase 2: Configure Auth Router handler
Create `/api/auth/[...nextauth]/route.ts` inside `apps/web` and `apps/mobile`:
*   Define the `CredentialsProvider` to validate emails against the MySQL `Employee` table.
*   Securely verify passwords using `bcrypt.compare`.
*   Include the user `role` and `employeeId` in the JWT token session object:
    ```typescript
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.role = user.role;
          token.employeeId = user.id;
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          session.user.role = token.role;
          session.user.id = token.employeeId;
        }
        return session;
      }
    }
    ```

### Phase 3: Route Guard Protection
Implement middleware-based routing protection (`middleware.ts`):
*   **Web App middleware:** Restricts `/workforce`, `/attendance`, `/leave`, `/shifts`, and `/sap` paths to authenticated sessions with role `Admin` or `Supervisor`.
*   **Mobile App middleware:** Restricts the mobile client to authenticated sessions with role `Employee`. Unauthenticated traffic is automatically redirected to `/login`.
*   **API Security:** Verify JWT token headers inside API route handlers.
