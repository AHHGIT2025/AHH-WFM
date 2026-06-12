# Project Status: AHH WFM

This file documents the status, baseline achievements, active environments, and release tags of the **AHH WFM** (Workforce Management) application suite.

---

## 1. System Overview & Tech Stack
AHH WFM is a full-stack, enterprise-grade workforce management application built as an **npm workspaces monorepo**.
- **Front-End Core:** Next.js 14 (App Router), TypeScript, Tailwind CSS, React 18.
- **Design Systems:**
  - **Web Console (Port 3100):** *Structured Efficiency* theme (Deep Navy `#091426` and Corporate Blue `#0058be`).
  - **Mobile Client (Port 3101):** *Corporate Integrity* theme (Al Hattab Maroon `#800040` and Bronze `#b89d7e`), displayed in a desktop simulator frame or native mobile display.
- **Database Engine:** Prisma Client (v5.22.0) with MySQL database. Supports dynamic fallback to a local JSON file (`db.json`) when `DATABASE_URL` is omitted.
- **Auto-Seeding:** Automatically seeds missing records (mock profiles, shifts, leave templates, default worksites) on initial query.

---

## 2. Milestone Metrics

| Milestone / Phase | Status | Release Tag | Description |
| :--- | :--- | :--- | :--- |
| **Milestone 1** | Completed | `v0.1` | Workspace monorepo setup & initial UI canvas layouts. |
| **Milestone 2** | Completed | `v0.2-auth-rbac-complete` | NextAuth secure routing with Azure AD and Credentials. |
| **Milestone 3** | Completed | `v0.3-modular-rest-complete` | Migration of unified `/api/db` to secure REST endpoints. |
| **Milestone 4 (Phase 1)** | Completed | `v0.4-workforce-directory-complete` | Employee CRUD, soft deletes, and Department models. |
| **Milestone 4 (Phase 2)** | Completed | `v0.5-attendance-geofencing-complete` | Geofencing validation, late tracking, and corrections. |
| **Phase 3** | Pending | - | Leave balances, accruals, and multi-level approvals. |

---

## 3. Implemented Feature Log

### Phase 1: Core Directory & Status Systems
- **Employee CRUD:** Soft-deletes deactivations (`isActive=false`) and full validation.
- **Status Management:** Real-time profile status monitoring (`On Duty`, `On Break`, `Offline`, `On Leave`).
- **Department Management:** Link employees to registered departments in both MySQL and fallback database modes.

### Phase 2: Attendance Control & Verification
- **Geofencing:** Radius boundary checking via Haversine formula against configurable worksite locations. Out-of-zone checks flag the entry as `"OUT_OF_ZONE"` instead of blocking.
- **Late Arrival Tracking:** Checks checks against scheduled shift hours (with a 5-minute grace period) to log lateness.
- **Attendance Corrections:** Employees submit corrections from mobile logs, retaining the original check-in values (`originalCheckIn`) while updating effective parameters on supervisor approval.
- **Double Action Guarding:** Restricts concurrent check-ins, check-outs without open check-ins, deactivated employees checking in, and validates coordinate payloads.
- **GPS simulation:** Built directly into the mobile homepage selector to ease verification testing.
