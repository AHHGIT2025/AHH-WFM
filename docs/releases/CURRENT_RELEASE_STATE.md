# AHH WFM — Current Release State

Last updated: August 9, 2026

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

Current programme:

* Commercial & Contracts lifecycle foundation (CL-0, PC-2A, CL-1 CRM & Deal Opportunities, CL-2 Pre-Contract Site Surveys & Audits)

* Commercial Command Center Phase CCC-0 Programme, Phase CCC-1 Operational Health, Phase CCC-2 Roster Coverage & Reliever Readiness Console, Phase CCC-3 Operational Escalation Queue & Workflow, Phase CCC-4 Commercial Health / Contract / SLA Analytics, Phase CCC-5 Executive Wallboard / Control-Room View

* Commercial Command Center Phase CCC-6 Mobile Command Suite

* Commercial Lifecycle Phase CL-3 — Pre-Contract Costing & Estimation (DEPLOYED AND CLOSED)

* Commercial Lifecycle Phase CL-4 — Proposal Management (LOCAL IMPLEMENTATION COMPLETED AND VERIFIED)

* SECFAC Phase 6A.2 schema reconciliation (SECFAC Status: PAUSED BY CIO)

Current release objective:

CL-4 Proposal Management — FULLY IMPLEMENTED AND VERIFIED LOCALLY.

Summary of CL-4 deliverables:

1. Added 3 Prisma models (`PreContractProposal`, `PreContractProposalVersion`, `ProposalIssuanceLog`) with enum `PreContractProposalStatus` (`DRAFT`, `IN_WORKFLOW`, `APPROVED_INTERNAL`, `ISSUED_TO_CLIENT`, `REJECTED`, `SUPERSEDED`) in `packages/database/prisma/schema.prisma`. Generated additive migration `20260809153000_add_cl4_precontract_proposals`.

2. Financial Authority: `PreContractCostEstimateVersion` is authoritative. Binds to `costEstimateVersionId` and `costEstimateChecksum`. Proposal engine does not recalculate costs, margins, markups, or selling prices.

3. Registered `precontract.proposal.view`, `precontract.proposal.manage`, `precontract.proposal.issue`, `precontract.proposal.crossCompany` permissions under `SUPER_ADMIN` and `ADMIN` roles in `apps/web/lib/permissions.ts`.

4. Built client confidentiality helper library `apps/web/lib/precontract-proposal.ts` with `toClientSafeProposalDTO()` using explicit allowlisting, SHA-256 snapshot generator `generateProposalSnapshot()`, and dynamic `isProposalExpired()` evaluator (`status === "ISSUED_TO_CLIENT" && validUntil != null && now > validUntil`).

5. Built REST APIs under `/api/v1/commercial/proposals/`:
   - `GET /api/v1/commercial/proposals` (list with auth, company, operation scope filters)
   - `POST /api/v1/commercial/proposals` (draft proposal creation from APPROVED costing version)
   - `GET /api/v1/commercial/proposals/[id]` (detail)
   - `PATCH /api/v1/commercial/proposals/[id]` (draft narrative/validity update, selling price edit prohibited)
   - `POST /api/v1/commercial/proposals/[id]/workflow` (centralized workflow actions SUBMIT, APPROVE, REJECT, RETURN)
   - `POST /api/v1/commercial/proposals/[id]/revision` (create new proposal revision v2 in DRAFT status)
   - `POST /api/v1/commercial/proposals/[id]/issue` (record issuance in ProposalIssuanceLog and update status to ISSUED_TO_CLIENT)
   - `GET /api/v1/commercial/proposals/[id]/preview` (client-safe DTO preview)

6. Built Web UI at `/commercial/quotations` (Proposal Register & New Proposal Modal) and `/commercial/proposals/[id]` (5-Tab Proposal Editor, Workflow Console, Issuance Modal, Client-Safe Preview & `@media print` CSS Print Layout).

7. Passed all verification gates: Prisma validate (exit 0), Prisma generate (exit 0), tsc Web (exit 0), tsc Mobile (exit 0), 11/11 CL-4 focused tests (exit 0), 30/30 CL-3 costing regression tests (exit 0), 55/55 security/permission tests (exit 0), full 59-suite API regression (1112/1121 pass, 9 skipped unchanged, exit 0), npm run build:web (exit 0), npm run build:mobile (exit 0).

8. SECFAC remains PAUSED BY CIO.

9. Deployment to SERVER remains BLOCKED pending explicit CIO authorization.


CCC-6 Status:

`DEPLOYED AND CLOSED`

CL-3 Status:

`FULLY VERIFIED — 30/30 JEST TESTS PASS — FULL REGRESSION 1161/1170 PASS (9 SKIPPED UNCHANGED) — COMMITTED c5e1052 AND PUSHED TO REMOTE`

Deployment approval state:

`BLOCKED`

---

## 2. Project paths and URLs

### LOCAL

Repository:

`D:\AI Projects\AHH WFM\app`

Web:

`http://localhost:3100`

Mobile:

`http://localhost:3101`

### SERVER

Repository:

`D:\Apps\AHH-WFM\dev`

Web:

`http://10.10.50.24:3200`

Mobile:

`http://10.10.50.24:3201`

---

## 3. Approved SERVER process names

Only the following PM2 processes may be used:

* `ahh-wfm-web-dev`

* `ahh-wfm-mobile-dev`

* `ahh-wfm-manpower-reconciliation-worker-dev`

* `ahh-wfm-secfac-evaluation-worker-dev`

* `ahh-wfm-secfac-monitoring-worker-dev`

* `ahh-wfm-secfac-notification-worker-dev`

Never run:

`pm2 restart all`

Any process temporarily stopped to release a Windows Prisma DLL lock must be restarted before deployment completion.

---

## 4. Branch and commit state

Branch:

`manpower-operations-scope`

Current release baseline (CL-3 final):

`c5e1052bdd62974cf7d01899c6c1a8358803ef5a`

Required direct verification:

* LOCAL `git status --short`;

* SERVER `git status --short`;

* confirmation that LOCAL and REMOTE match;

* confirmation of whether SERVER is still on the stable baseline or another commit.

Current values (as of 2026-08-09):

| Item                | Value                          |
| ------------------- | ------------------------------ |
| LOCAL HEAD          | `c5e1052bdd62974cf7d01899c6c1a8358803ef5a` (CL-3 case-state guard + test hardening) |
| REMOTE HEAD         | `c5e1052bdd62974cf7d01899c6c1a8358803ef5a` |
| SERVER HEAD         | `13e7b516dc0ede72dc61b4a8f7173a95b5bd0f78` |
| LOCAL working tree  | `CLEAN` |
| SERVER working tree | `CLEAN` |

---

## 5. Functional LOCAL status

The following CL-3 functionality is visible and working in the LOCAL Web application:

* Pre-Contract Costing Register (`/commercial/costing`);

* Draft costing estimate creation from completed site surveys;

* Line item breakdown with Gross Margin %, Target Margin Selling Price, Markup %, Target Markup Selling Price calculations;

* Line item override with audit trail (`PreContractCostOverrideLog`);

* Version revisioning (clone to new version with reason);

* Centralized workflow (SUBMIT → IN_WORKFLOW, APPROVE → APPROVED + SHA-256 snapshot, RETURN → DRAFT, REJECT → REJECTED);

* Multi-level workflow (configurable via Settings > Workflow Setup);

* Company boundary enforcement and operation scope isolation (SG vs FM);

* CANCELLED/SUPERSEDED case lifecycle guard (HTTP 400).

---

## 6. Accepted verification baseline

### CL-3 focused suite baseline

```text
Test Suites: 1 passed, 1 total
Tests:       30 passed, 30 total
Snapshots:   0 total
Time:        ~17 s
Exit code:   0
```

### Full API regression baseline (as of CL-3 commit c5e1052)

```text
Test Suites: 1 skipped, 59 passed, 59 of 60 total
Tests:       9 skipped, 1161 passed, 1170 total
Snapshots:   0 total
Time:        ~249 s
Exit code:   0
```

The skipped suite count (1) and skipped test count (9) must not increase without CIO approval.

### CL-3 mandatory verification gates (all passed)

1. Prisma schema validation (`npx prisma validate --schema packages/database/prisma/schema.prisma`): `PASS (exit 0)`
2. Web TypeScript check (`npx tsc --noEmit --project apps/web/tsconfig.json`): `PASS (exit 0)`
3. CL-3 Jest focused suite (`npx jest --config=tests/jest.api.config.js tests/api/cl3-precontract-costing.spec.ts --runInBand --forceExit`): `PASS (30/30, exit 0)`
4. Full API regression (`npx jest --config=tests/jest.api.config.js --runInBand --forceExit`): `PASS (1161/1170, 9 skipped, exit 0)`
5. Local dev server (`http://localhost:3100`) responding: `CONFIRMED`

---

## 7. Authoritative migration inventory

| Migration name | Status | Notes |
|---|---|---|
| `20260809130000_add_cl3_precontract_costing` | Applied (LOCAL) | Adds 4 CL-3 tables + relations to Case/Survey |
| (All prior migrations) | Applied (LOCAL & SERVER) | Unchanged |

Server migration status for `20260809130000_add_cl3_precontract_costing`: **NOT YET APPLIED** (deployment blocked).

---

## 8. Current blocking issues

SERVER deployment remains blocked by the following:

1. Deployment requires explicit CIO authorization to move from `BLOCKED` to `DEPLOYMENT APPROVED`.

2. `20260809130000_add_cl3_precontract_costing` migration has not been applied on SERVER.

---

## 9. Deployment approval state

Current state:

`DEPLOYMENT BLOCKED`

No SERVER deployment commands are approved.

No PM2 restart is approved.
