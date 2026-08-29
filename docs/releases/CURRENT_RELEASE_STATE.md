# AHH WFM — Current Release State

Last updated: August 29, 2026

Timezone: Asia/Qatar

Repository: `AHHGIT2025/AHH-WFM`

Primary branch: `manpower-operations-scope`

This document contains the changing release state for the AHH WFM project.

Permanent project rules are defined in the repository root:

`AGENTS.md`

When this file conflicts with an older conversation, walkthrough or report, use the newest directly verified repository, database and SERVER evidence.

Do not store passwords, API keys, tokens, connection strings, `.env` values or sensitive employee/client data in this file.

---

## 1. Release identity

Current programme phases:

* Phase AT-2 — Attendance Reconciliation & Approval (LOCAL IMPLEMENTATION COMPLETED AND VERIFIED — PENDING CIO SERVER DEPLOYMENT APPROVAL)
* Unified Attendance Intake Foundation Phase AT-1 & AT-1A — Monthly Attendance Matrix & Timesheet Profile + Attendance Navigation & Scope Isolation + Template Security Correction (DEPLOYED TO SERVER, SECURITY VERIFIED AND CLOSED)
* SECFAC Phase 6B — Security Post Orders, Shift Briefings, Incident/Occurrence Management & Supervisor Field Inspections (LOCAL IMPLEMENTATION COMPLETED AND VERIFIED — PENDING SERVER DEPLOYMENT)
* Commercial Lifecycle Phase CL-5 through CL-8 — Operations Handover, Addendums, Renewals (DEPLOYED AND CLOSED)

Current release objective:

`Phase AT-2: Attendance Reconciliation & Approval Implementation (Engine, API Routes, Workspaces, Immutable Approved Snapshotting, Restrictive Migration & 24-Table Zero-Write Certification).`

Starting SERVER Baseline:

`4ea0f03f67d70526b3e6de7bfbd266541109b3e7` (Certified functional baseline: `9e2318fa92a05a6ab065399a90bc18a9c740fa8c`)

Current Certified AT-2 Release Commit:

`e9a1f33344884376c1f38d8b59c44ae5f11ae4b1`

Authoritative Phase AT-2 Migration:

`20260829094000_add_at2_attendance_reconciliation_approval` (Applied LOCAL, Pending SERVER)


---

## 2. CL-1 Planned Activities — Authoritative Deliverables

### Schema & Migration

Migration name: `20260811120000_add_cl1_activities_and_tasks`

Status: Applied (LOCAL), NOT YET APPLIED (SERVER)

DDL includes:
- `CommercialActivity` table with `UNIQUE INDEX (externalProvider, externalItemId)` for external deduplication
- `CommercialTask` table
- All FKs use `ON DELETE SET NULL ON UPDATE CASCADE`
- 0 destructive SQL statements (purely additive DDL)
- Encoding: UTF-8, NO BOM, LF
- SHA-256: `C28FF2565CA3133771E042C4D2FEF618C282BB2AEF0878E442A3CEBEE38174A3`
- Git blob: `d4565d4868969fdc93395ea08b1ef352001fd0a0`

### Commercial Reminder Worker

Process identity: `ahh-wfm-commercial-reminder-worker-dev`

Source: `apps/web/workers/commercial-reminder-worker.ts`

PM2 config: `ecosystem.config.js` — registered with `autorestart: true`, `instances: 1`, `exec_mode: fork`, `max_memory_restart: 500M`

Script entrypoint (SERVER): `dist/workers/apps/web/workers/commercial-reminder-worker.js`

NPM script (LOCAL dev): `npm run start:commercial-reminder-worker`

Reminder claim authority: Prisma `$transaction` containing `updateMany` (atomic claim) + `userActivityLog.create` (notification persistence). Transaction is `NOTIFICATION_CREATED + REMINDER_MARKED_SENT` or `NEITHER COMMITTED`.

Notification-failure behavior: Rolled-back transaction leaves `reminderSent = false` — reminder remains retryable on subsequent scans.

### Outlook Integration — AUTHORITATIVE CLASSIFICATION

**OUTLOOK_MANUAL_LINK_COMPLETE**

Manual activity metadata linkage (externalProvider, externalItemId, externalWebLink, meeting link fields) is fully operational.

**OUTLOOK_GRAPH_IMPLEMENTATION_BLOCKED_BY_SECURITY_DEPENDENCY**

Inspected source files (August 11, 2026):
- `apps/web/app/api/v1/commercial/outlook/status/route.ts` — configuration-gated status endpoint only
- `apps/web/app/api/v1/commercial/outlook/` — contains only `status/` subdirectory

No Microsoft Graph integration code exists in the repository:
- No `@azure/msal-node` or `@azure/identity` token acquisition
- No `@microsoft/microsoft-graph-client` Graph HTTP client
- No Outlook Email selected-item lookup/retrieval
- No Outlook Calendar selected-item lookup/retrieval
- No Graph response/error handling
- No mailbox/account isolation boundary

Live/selected-item Microsoft Graph integration is deferred pending:
1. Approved Microsoft Entra application registration and configuration
2. Approved authentication model (client credentials vs. delegated OAuth)
3. Required Graph API permissions (`Mail.Read`, `Calendars.Read`, scoped per user)
4. Secure token/session architecture for any delegated access flow
5. CIO approval to implement and register the Graph adapter

CL-1 Activities release is `READY FOR SERVER DEPLOYMENT` with this honest classification. Manual interaction logging covers 100% of the approved CL-1 activity types (EMAIL, CALL, MEETING, NOTE, VISIT, OTHER).

### Regression Suite Counts — Authoritative (August 11, 2026)

All six suites individually run against candidate `071869c08c963e283d92fbf05d9bdb959df18419`. All files byte-identical to SERVER baseline `5982cd1097d6c560648a7575caa50c5d308426fa`.

| Suite | Active Tests | Skipped | Jest Result |
|---|---|---|---|
| `cl8-contract-renewal.spec.ts` | 10 | 0 | `10 passed, 10 total` |
| `cl7-post-award-addendums.spec.ts` | 11 | 0 | `11 passed, 11 total` |
| `cl6-operations-handover.spec.ts` | 10 | 0 | `10 passed, 10 total` |
| `cl5-contract-conversion.spec.ts` | 16 | 0 | `16 passed, 16 total` |
| `manpower-phase-mp1-contracts.spec.ts` | 17 | 0 | `17 passed, 17 total` |
| `security.spec.ts` | 12 | 0 | `12 passed, 12 total` |
| `cl1-activities.spec.ts` | 13 | 0 | `13 passed, 13 total` |

**Historical count reconciliation:**

Previous walkthrough reports used incorrect in-session test-count summaries for several suites. The repository test files themselves were UNCHANGED against the SERVER baseline — as confirmed by empty `git diff`. The correct authoritative counts are the counts reported above from the actual test file inventories and individual Jest runs.

- CL-5 `9` was incorrect → actual `16` (previous reports undercounted a 16-test file)
- Contract `10` was incorrect → actual `17` (previous reports undercounted a 17-test file)
- CL-6 `9` was incorrect → actual `10` (previous reports undercounted a 10-test file)
- Security `27` was incorrect → actual `12` (previous reports overcounted a 12-test file)

No test was removed. No assertion was weakened. Root cause: prior walkthroughs reported counts from combined-run summaries without individually counting active `it()` cases per file.

### PM2 Process Registry

Approved named processes (updated for CL-1):

* `ahh-wfm-web-dev`
* `ahh-wfm-mobile-dev`
* `ahh-wfm-manpower-reconciliation-worker-dev`
* `ahh-wfm-secfac-evaluation-worker-dev`
* `ahh-wfm-secfac-monitoring-worker-dev`
* `ahh-wfm-secfac-notification-worker-dev`
* `ahh-wfm-commercial-reminder-worker-dev` ← NEW for CL-1

---

## 3. Project paths and URLs

### LOCAL

Repository: `D:\AI Projects\AHH WFM\app`

Web: `http://localhost:3100`

Mobile: `http://localhost:3101`

### SERVER

Repository: `D:\Apps\AHH-WFM\dev`

Web: `http://10.10.50.24:3200`

Mobile: `http://10.10.50.24:3201`

---

## 4. Mandatory conversation continuity rule

1. If the context window approaches token limits, NEVER clear, delete or truncate the conversation history.
2. Create a structured continuation handoff carrying forward the complete authoritative project state under the SAME `AHH WFM Project`.
3. Conversation branching is NOT Git branching. Continue using approved Git branch `manpower-operations-scope`.

---

## 5. Functional LOCAL status

The following Commercial Lifecycle functionality is visible and working in the LOCAL Web application:

* Commercial > Opportunities (`/commercial/opportunities`)
* Commercial > Site Surveys (`/commercial/surveys`)
* Commercial > Cost Estimates (`/commercial/costing`)
* Commercial > Quotations & Proposals (`/commercial/quotations` and `/commercial/proposals/[id]`)
* Contract Conversion Console (`/commercial/contract-conversion/[id]`)
* Manpower Contracts Register (`/manpower/contracts`)
* Commercial > Activities & Task Console (`/commercial/activities`)
* Commercial > CRM Prospects (`/commercial/crm`)
* Commercial > Amendments (`/commercial/amendments`)
* Commercial > Renewals (`/commercial/renewals`)

## 6. Authoritative migration inventory

| Migration name | Status | Notes |
|---|---|---|
| `20260829094000_add_at2_attendance_reconciliation_approval` | Applied (LOCAL), Pending SERVER | Adds 6 AT-2 models: `attendance_reconciliation_batches`, `attendance_reconciliation_candidates`, `attendance_reconciliation_candidate_sources`, `attendance_reconciliation_decisions`, `attendance_reconciliation_events`, `attendance_approved_snapshots`, `attendance_approved_snapshot_rows` |
| `20260825120000_add_at1_attendance_import_staging` | Applied (LOCAL & SERVER) | Adds `attendance_import_batches`, `attendance_import_rows` tables; deployed with AT-1 baseline |
| `20260811120000_add_cl1_activities_and_tasks` | Applied (LOCAL) | Adds `CommercialActivity`, `CommercialTask` tables; `UNIQUE (externalProvider, externalItemId)` |
| `20260810200000_add_cl8_contract_renewal` | Applied (LOCAL) | Adds `ManpowerContractRenewalCase`; `@@unique([contractId])` |
| `20260810100000_add_cl5_client_acceptance_contract_conversion` | Applied (LOCAL & SERVER) | Adds `PreContractClientResponse`; 6 audit fields on `ManpowerContract` |
| `20260809153000_add_cl4_precontract_proposals` | Applied (LOCAL & SERVER) | Deployed in release `14fb15a` |
| `20260809130000_add_cl3_precontract_costing` | Applied (LOCAL & SERVER) | Deployed on SERVER |
| (All prior migrations) | Applied (LOCAL & SERVER) | Unchanged |

Server migration status for AT-1 (`20260825120000_add_at1_attendance_import_staging`): **ALREADY APPLIED** (deployed with certified AT-1 baseline `a026d3bfced189235597f8a55c62ba5865a880e2`).

Phase AT-1A migration status: **ZERO NEW DATABASE MIGRATIONS** (reuses existing staging schema without modifications).

Server migration status for `20260811120000_add_cl1_activities_and_tasks`: **NOT YET APPLIED** (deployment pending CIO authorization).

Server migration status for `20260810200000_add_cl8_contract_renewal`: **NOT YET APPLIED** (deployment pending CIO authorization).

---

## 7. Current blocking issues

SERVER deployment remains blocked by the following:

1. Deployment requires explicit CIO authorization: `DEPLOYMENT APPROVED`.
2. Migrations `20260811120000_add_cl1_activities_and_tasks` and `20260810200000_add_cl8_contract_renewal` have not been applied on SERVER.
3. Outlook Graph live integration requires Entra app registration and CIO-approved auth model before implementation.

SECFAC remains **PAUSED BY CIO**. All SECFAC workers and code untouched.

---

## 8. Deployment approval state

Current state:

`CLOSED / DEPLOYED / CERTIFIED — ATTENDANCE NAVIGATION, SCOPE & TEMPLATE SECURITY`

Authoritative SERVER Deployed Commit:

`cceca671a14687423e98ac93aacc43c61377f203` (Functional code: `9e2318fa92a05a6ab065399a90bc18a9c740fa8c`)

Server Migration Status:

`20260825120000_add_at1_attendance_import_staging` (ALREADY APPLIED)
Phase AT-1 / AT-1A / Scope Correction: 0 NEW DATABASE MIGRATIONS
