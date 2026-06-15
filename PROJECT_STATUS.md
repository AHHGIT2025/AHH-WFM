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
| **Milestone 5 (Phase 3A)**| Completed | `v0.6-leave-balance-engine-complete` | Leave types, dynamic balances, audit ledger, holidays, and calculations. |
| **Phase 3B** | Completed | `v0.7-enterprise-leave-workflow-complete` | Multi-level approval workflows, delegation, SLA tracking, and thresholds. |
| **Phase 4A** | Completed | `v0.8-shift-scheduling-complete` | Shift templates, rotation templates, shift assignments, and conflict detection. |
| **Phase 4B** | Completed | `v0.9-scheduling-roster-overtime-complete` | Overtime auto-calculation, rates, coverage heatmap, drag-and-drop, and shift swaps. |
| **Phase 5A** | Completed | `v0.10-sap-integration-foundation` | SAP SuccessFactors integration database models, mock sync engine, and Web Admin dashboard. |
| **Phase 5B.1**| Completed | `v0.11-sap-operational-sync-leave-attendance` | SAP SuccessFactors outbound integration for Leave (EmployeeTime) and Attendance (TimeSheetEntry), idempotency, and reconciliation. |
| **Phase 5B.2**| Completed | `v0.12-sap-operational-sync-payroll-roster` | SAP SuccessFactors outbound integration for Overtime (EmpCompensation) and Roster (ShiftAssignment), staging, locking, and reconciliation. |
| **Phase 6.1**| Completed | `v0.13-reporting-backup-foundation` | Executive & domain-specific reports API, CSV/JSON exports, user audits, and admin backups. |
| **Phase 7** | Completed | `v0.14-mobile-app-foundation` | Next.js Mobile PWA client with dedicated BFF API, Geofence priority routing, and supervisor dashboards. |
| **Phase 8** | Completed | `v0.15-master-data-scheduler-mobile-integration` | Master Data Hub CRUD UI, Advanced Scheduler Grid Cell Actions, Mobile Integration & Priority Cascade. |
| **Phase 9** | Completed | `v0.17-supervisor-scoping-and-auth` | Supervisor scopes, LOCAL/SSO accounts, force password rotation, and universal filters reset. |
| **v0.18** | Completed | `v0.18-mobile-profile-photo-and-polish` | Mobile profile photo uploads, cache-busting sync, Designation tags, ERP terminology rebrand, and Android Capacitor wrapper support. |
| **v0.18.1** | Completed | `v0.18.1-clearance-management-workflow` | Dynamic 15-step clearance requests, cascading filters, details snapshot, auto-applicability skipping, and template configuration builder. |
| **v0.18.2** | Completed | `v0.18.2-employee-company-identity-integration` | Company assignment, Qatar ID (QID), and Passport integration across workforce directory, REST APIs (with role masking), bulk import, clearance snapshots, and mobile profile. Also includes Company and Cost Center dropdown labels and population fixes. |

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

### Phase 3A: Leave Balances & Holiday Calendar
- **Leave Type Configurations:** Defined configurations for Annual, Sick, Emergency, Unpaid, and Business Travel leave categories.
- **Ledger-based Balances:** Integrated a dynamic `LeaveBalance` tracker and `LeaveBalanceLedger` writing INITIAL, ACCRUAL, MANUAL_ADJUSTMENT, and LEAVE_TAKEN logs.
- **Holiday Calendar Registry:** Seeded default Qatar national and company breaks, dynamically adjusting leave request durations.
- **Calculation Engine:** Weekend-aware (Friday/Saturday) and holiday-aware deduction calculations, excluding non-working days from leave charges.
- **Manual Adjustment Console:** Admin page tools to adjust balance allotments with audit reasoning.

### Phase 3B: Multi-Level Approval Workflows, SLA & Delegation
- **Hierarchical Approval Steps:** Seeded structured workflows for Supervisor-only, Supervisor-Manager-HR sequential steps, and Auto-approvals.
- **SLA Parameters:** Track submittedAt, firstActionAt, approvedAt, approvalDurationHours, and escalationCount.
- **Approval Delegation:** Configure delegate authority (validFrom, validTo, reason) to route tasks away from absent approvers.
- **Escalation Rules:** Automatically warning and escalates requests pending beyond SLA threshold times (e.g. 72 hours).
- **History Timeline Log:** Full audit records of step approvals and comment history transitions.
- **Approvals Dashboard:** Segmented consoles in Web console separating direct queue, delegated items, and escalated items.

### Phase 4A: Shift Scheduling, Rotations & Conflict Detection
- **Shift Template Management:** Seeded default templates (Morning, Evening, Night, Split, Flexible) and integrated customizable rules for core hours and split shifts.
- **Rotation Schedules:** Seeded default templates (5x2, 6x1, 4 On/4 Off) enabling cyclically mapped assignments.
- **Conflict Checking:** Integrated real-time checker blocking assignments to inactive employees, warning about overlapping shifts, and highlighting conflicts against approved leaves.
- **REST Endpoints:** Added unified backend APIs under `/api/v1/shifts/` for templates, assignments, bulk applications, and rotations.
- **Scheduler Grid Web Board:** Built planner grid highlighting warning conflict badges and providing controls for bulk assignments.
- **Mobile Rosters:** Added a `/shifts` page on mobile allowing operatives to browse their My Shifts and Upcoming Shifts calendar logs.

### Phase 4B: Overtime, Coverage Heatmaps & Shift Swaps
- **Overtime Engine:** Real-time auto-calculation of overtime (Standard, Weekend, Holiday, Night, Special Event) triggered immediately on checkout.
- **Configurable Overtime Rates:** Managed through the `OvertimeRate` database model with custom multipliers, fixed rates, and active triggers. Seeded standard multipliers (1.25x, 1.5x, 2.0x).
- **Manager Overtime Console:** Review workflow for calculated overtime with audit notes, locking in approved values.
- **Togglable Heatmaps:** Graphical coverage visualization overlaying red (understaffed), green (optimized), and yellow (overstaffed) status on the roster boards.
- **Drag-and-Drop Board:** Enabled rescheduling by moving shift cards between employee dates with inline conflict safety checks.
- **Shift Swaps Console:** Mobile requisition wizard for bilateral exchanges, and a web admin swap manager for atomic swap approvals.

### Phase 5A: SAP Integration Foundation
- **Database Schema Models:** Added `SapConnection`, `SapSyncJob`, `SapSyncLog`, `SapFieldMapping`, and `SapRetryQueue` models to the MySQL schema.
- **Sync Sandbox Engine:** Built simulation-ready inbound sync loop for employees, departments, cost centers, and locations.
- **Master Data Mapping & Deactivations:** Sync updates existing records and registers new employees. Marks employees as inactive (`isActive = false`) and status `Offline` locally when the SAP payload flags them as `TERMINATED`.
- **Fault-Tolerance Controls:** Logs failures in the `SapSyncLog` and caches invalid configurations inside the `SapRetryQueue` under pending states.
- **Web Admin Dashboard:** Integrated a connection status monitor card, sync trigger controls panel, job execution history grid, active mappings editor console, and retry queue manager.

### Phase 5B.1: SAP Leave & Attendance Sync
- **Outbound Sync Queue:** Exports approved leave requests and completed attendance check-outs into `SapExportQueue`.
- **Mock OData Payloads:** Generates sandbox `EmployeeTime` and `TimeSheetEntry` schemas.
- **Idempotency Controls:** Enforces uniqueness using `LEAVE_EXPORT_[ID]` and `ATT_EXPORT_[ID]` keys to block duplicate syncing.
- **Acknowledgement Tracking:** Records SuccessFactors API tracking IDs, statuses, and timestamps.
- **Reconciliation Engine:** Compares local WFM database hours with SAP timesheet hours to detect and flag gaps.

### Phase 5B.2: SAP Overtime, Payroll & Roster Sync
- **Payroll Staging Engine:** Aggregates approved overtime hours into `SapPayrollStage` entries, dynamically translating to Compensation values in base currency QAR.
- **Wage Type Mapping:** Translates weekday, weekend, night, and holiday overtime rules to respective wage codes (`WT_OT_STD`, `WT_OT_WKD`, `WT_OT_HOL`, `WT_OT_NGT`).
- **Period Locks Control**: Lock and freeze payroll stages preventing further edits or adjustments on locked months via `SapPayrollPeriodLock`.
- **CompCompensation Exports**: Outbound compilation transfer of locked and approved staging elements.
- **Roster Schedules Export**: Exports workforce rosters (`ShiftAssignment` records) into SuccessFactors calendar.
- **Overtime Reconciliation discrepancies**: Extends audit tool comparisons to overtime logs.

### Phase 6.1: Reporting & Backup Foundation
- **Database Model Registries**: Added schemas for `SavedReport`, `ReportExportLog`, `UserActivityLog`, `ProductionCheckLog`, `BackupJob`, and `BackupAuditLog`.
- **Reporting APIs**: Engineered endpoints for executive summaries (headcounts, compliance rate, leaves, OT costs, sync health), attendance records, leave tracking, overtime, schedules, and SAP integrations.
- **CSV/JSON Exports**: Implemented a export framework saving exports under `storage/exports/` and auditing downloads with path-traversal guards.
- **Admin Backup System**: Created database-agnostic JSON export algorithms (excluding raw credentials and pass-hashes), checksum generation, job history tracking, and download audits under `/admin/backup`.

### Phase 7: Mobile App Foundation
- **Standalone Mobile Shell**: Built Next.js mobile wrapper inside `apps/mobile` following the 'Corporate Integrity' design logic (Maroon & Gold).
- **Mobile BFF APIs**: Isolated APIs under `apps/mobile/app/api/v1/` to protect Web Admin payloads and optimize mobile responses.
- **Geofence Priority Engine**: Enforces check-in rule cascade (Active Deployment > On-Call Assignment > Shift Assignment > Allowed Location > Office Default > Policy Fallback).
- **Employee Portal Screens**: Implemented specialized mobile screens for Dashboard, Punch Capture, Schedule, History, Leave Management, and Notice Board.
- **Supervisor Mobile Dashboard**: Added real-time roll-call counters (Present, Absent, Late, Out of Zone) and team rosters tailored for mobile supervisors.

### Phase 8: Master Data Hub & Advanced Scheduler Integration
- **Master Data Hub UI**: Centralized dynamic dashboard (`/admin/masters`) using a unified `MasterDataEntityTab` component for Companies, Departments, Designations, Trades, Locations, Projects, and Standby Rules.
- **Advanced Scheduler Grid**: Enabled deep cell-actions (`/shifts`) for assigning deployments, splits, on-call duties, and reliever linkage.
- **Mobile PWA Integration**: Verified seamless flow of data where web-created projects, sites, custom allowed punch locations, and deployments dynamically feed into the Mobile BFF and correctly enforce geofence priorities.
- **Flexible Employee Punch Policies**: Added granular overrides per employee (Default Punch Location, Multiple Allowances, Office/Site/On-Call Flags, Radius Overrides, and Out-of-Zone permissions) managed from the Workforce UI.

### Phase 9: Supervisor Hierarchy & User Accounts
- **Account Management Dashboard**: Centralized `/admin/users` UI to manage auth modes (LOCAL, SSO, LOCAL_AND_SSO), enforce account locks, view failed attempts, and force password resets.
- **Enforced Password Cycle**: Implementation of the `mustChangePassword` flag intercepting logins to force a `/change-password` redirection.
- **Multi-tiered Supervisor Scoping**: Backend scoping algorithms sorting managers into DIRECT_REPORTS, PROJECT, SITE, and DEPARTMENT categories.
- **Mobile Supervisor UI Uplift**: Dashboard now aggregates live attendance figures utilizing direct server-side team scopes. Adds inline leave approvals directly within the mobile layout.
- **Universal Filters Reset**: Global UI action to instantly revert complex multi-select filtering states across admin data grids.

- **Clearance Management Module**: Dynamic 15-step clearance requests, cascading Company -> Department -> Employee filters, details snapshot, auto-skipping IT (credentials/email/asset check) and Accommodation steps, dynamic approver overrides, custom template builder panel, and printable FM-14-04-02 layouts.
- **Company Assignment & Identity Integration**: Integrated Company assignment and identity document tracking (Qatar ID & Passport details) with strict role-based privacy masking, cascading filtering in Workforce Directory forms, automatic mismatched field resets, and mobile profile sync.
- **Company & Cost Center Dropdown Labels & Population Fix**: Resolved database relation populations for companies, departments, locations, and cost centers. Corrected blank options `()` and raw UUID leaks in Master Data Hub tables and Add/Edit employee modal dropdowns. Implemented dual filters (Employment Status vs Duty Status) and cascading select resets in the Workforce Directory.

- **Current Focus:** Final Integration Validation & Release Stabilization
- **Latest Checkpoint:** `v0.18.2-employee-company-identity-integration`
- **Next Phase:** N/A (Project Wrap-Up)
