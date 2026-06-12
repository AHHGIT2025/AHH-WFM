# Project Context: AHH WFM

This file serves as the permanent memory and source of truth for the **AHH WFM** (Workforce Management) monorepo application. It must be updated after every major change or milestone.

---

## 1. Project Overview & Tech Stack

**AHH WFM** is a full-stack, enterprise-grade workforce management monorepo containing a Web Admin Command Center and a Mobile Employee Client.

*   **Front-End Core:** Next.js 14 (App Router), TypeScript, Tailwind CSS, React 18.
*   **Design Designations:**
    *   **Web Console:** *Structured Efficiency* theme (Deep Navy `#091426` and Corporate Blue `#0058be` with Inter / IBM Plex typography).
    *   **Mobile App:** *Corporate Integrity* theme (Al Hattab Maroon `#800040` and Bronze `#b89d7e` with Inter typography).
*   **Database ORM:** Prisma Client (v5.22.0) with MySQL database support.
*   **Active Port Allocations:**
    *   **Web App:** Port **`3100`** (Local URL: [http://localhost:3100](http://localhost:3100))
    *   **Mobile App:** Port **`3101`** (Local URL: [http://localhost:3101](http://localhost:3101))

---

## 2. Workspace Monorepo Layout

We use **npm workspaces** to manage packages and apps:

```
ahh-wfm/
├── package.json                 # Workspace dependencies and commands
├── tsconfig.json                # Shared TypeScript compiler settings
├── apps/
│   ├── web/                     # Web Admin Command Center Next.js Client
│   └── mobile/                  # Mobile Employee Portal Next.js Client
└── packages/
    ├── config/                  # Shared configuration values and Tailwind presets
    ├── types/                   # Reusable TypeScript model interfaces
    ├── database/                # Prisma ORM MySQL schemas and Client singleton
    ├── mock-data/               # Database wrapper (queries MySQL or falls back to JSON file)
    └── ui/                      # Shared styling React components (Card, Badge, Button, Input, Modal)
```

---

## 3. Data Integration & Persistence Layer

*   **Dual-Mode Broker:** `@ahh-wfm/mock-data` checks for `DATABASE_URL` in env variables:
    1.  **MySQL Mode:** If `DATABASE_URL` is set, all API calls read/write from a live MySQL server via `@ahh-wfm/database`.
    2.  **Fallback Mode:** If not set, it reads/writes from the local JSON database file (`packages/mock-data/db.json`).
*   **Auto-Seeding:** If connected to MySQL and the tables are empty, the package automatically seeds the tables with default operative profiles, shift masters, mapping variables, and announcements on first request.

---

## 4. Current Feature Inventory

### Web Admin Command Center (`apps/web`)
*   **Bento Dashboard:** Displays latencies, operative counts, active leaves, and an interactive topographic Doha map with glowing geolocated pins.
*   **Workforce Directory:** Employee list with status filters and manual SuccessFactors push sync buttons.
*   **Attendance Monitor:** Ledger auditing coordinates, resolved location names, checkout timestamps, and devices.
*   **Leave Approvals:** Card board for approving or rejecting leave requests.
*   **SAP Hub & Mapper:** Latency trackers, Sync Log lists, and SuccessFactors field mappings.
*   **Shift Master:** Admin controls to define shifts and set rotational periods.

### Mobile Employee App (`apps/mobile`)
*   **Responsive Mockup Wrapper:** Smartphone simulator frame centered on desktop screens, adapting to native full-screen on mobile devices.
*   **Check-In Panel:** Location resolution and check-in/out triggers.
*   **Leave Requests:** Submission forms and remaining balance status charts.
*   **News Board & Profiles:** Company notice notifications feed and certifications dashboard.

---

## 5. Authentication & Role-Based Access Control (RBAC)

We use **NextAuth.js** for securing routes and endpoints. It operates in a hybrid layout:
1.  **Microsoft Entra ID (Azure AD / Office 365 OAuth):** Authenticates corporate logins. User emails are mapped against the local `Employee` database table at callback time to resolve active roles (`ADMIN`, `SUPERVISOR`, `EMPLOYEE`).
2.  **Credentials Provider Bypass:** Validates local email/password forms using `bcryptjs` password hashing to simplify local development testing.

### Middleware Route Guards
*   **`apps/web/middleware.ts`**: Restricts pages to sessions with role `ADMIN` or `SUPERVISOR`. Redirects unauthenticated users or standard employees to `/login`.
*   **`apps/mobile/middleware.ts`**: Restricts the mobile client to authenticated users only.

### Default Seed Logins
All default mock employees are seeded with password `"Password123!"` (hashed with salt `10`).
*   `admin@alhattab.qa` $\rightarrow$ Role: `ADMIN`
*   `sarah.kim@alhattab.qa` $\rightarrow$ Role: `SUPERVISOR`
*   `ahmed.ali@alhattab.qa` $\rightarrow$ Role: `EMPLOYEE`

---

## 6. Environment Variables Setup (`.env`)

Every package/application (`apps/web/.env`, `apps/mobile/.env`, `packages/database/.env`) requires this configuration to activate MySQL and NextAuth:
```env
DATABASE_URL="mysql://username:password@localhost:3306/ahh_wfm"
NEXTAUTH_SECRET="a_random_32_character_hex_string"

# Optional (for Azure AD OAuth activation)
AZURE_AD_CLIENT_ID="your_azure_ad_client_id"
AZURE_AD_CLIENT_SECRET="your_azure_ad_client_secret"
AZURE_AD_TENANT_ID="your_azure_ad_tenant_id"
```
*(Special characters in the database password must be URL-encoded, e.g. `$` $\rightarrow$ `%24`)*

---

## 7. Git Status & Milestones

*   **Repository URL:** [https://github.com/AHHGIT2025/AHH-WFM](https://github.com/AHHGIT2025/AHH-WFM)
*   **Current Branch:** `main`
*   **Milestone Tag v0.1:** Tagged at commit `b2239c4` (baseline structure complete).
*   **Milestone Tag v0.2:** Tagged as `v0.2-auth-rbac-complete` (hybrid authentication complete).
