# AHH WFM — Current Release State

Last updated: August 10, 2026

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

* Commercial Lifecycle Phase CL-4 — Proposal Management (DEPLOYED AND CLOSED)

* Commercial Lifecycle Phase CL-5 — Client Acceptance, Award & Contract Conversion (LOCAL IMPLEMENTATION COMPLETED AND VERIFIED)

* SECFAC Phase 6A.2 schema reconciliation (SECFAC Status: PAUSED BY CIO)

Current release objective:

CL-5 Client Acceptance, Award & Contract Conversion — FULLY IMPLEMENTED AND VERIFIED LOCALLY.

Current Git commit baseline:

`d8b95d9c43c2c1057a79d641217dd6964b83e9e3`

Summary of CL-5 deliverables:

1. **Prisma Schema Enhancements**:
   - Added `PreContractClientResponse` model (`packages/database/prisma/schema.prisma`) linked to `PreContractProposalVersion` with `@unique proposalVersionId` enforcement to guarantee single terminal response per revision.
   - Enhanced `ManpowerContract` with 6 explicit audit lineage fields: `sourceClientResponseId`, `sourceProposalVersionId`, `sourceSnapshotChecksum`, `billingBasis`, `currency`, `approvalStatus`.
   - Added foreign key relations linking `ManpowerContract` back to source `PreContractClientResponse` and `PreContractProposalVersion`.
   - Created additive migration `20260810100000_add_cl5_client_acceptance_contract_conversion`.

2. **Client Acceptance & Contract Conversion Engine (`apps/web/lib/contract-conversion.ts`)**:
   - `recordClientResponse()`: Validates `ISSUED_TO_CLIENT` status and SHA-256 snapshot checksum integrity before recording client response (`ACCEPTED`, `REJECTED`, `CHANGE_REQUESTED`).
   - `getConversionReadiness()`: Evaluates 5 conversion readiness gates (Accepted response presence, Client Master resolution, Proposal Version snapshot integrity, Duplicate contract conversion guard, Requirements completeness).
   - `convertToContract()`: Atomic transaction executing contract conversion into `DRAFT` status with **ZERO auto-activation**. Reuses existing `ManpowerContract` model, links audit lineage, and inherits manpower requirements into `ContractManpowerRequirement`.

3. **REST APIs & Client Documents Module**:
   - `POST /api/v1/commercial/proposals/[id]/response` — Client response recording.
   - `GET /api/v1/commercial/proposals/[id]/conversion-readiness` — Real-time readiness evaluation.
   - `POST /api/v1/commercial/proposals/[id]/convert` — Contract conversion execution.
   - `POST /api/v1/commercial/client-documents/upload` — Award/LOA/PO client document upload.
   - `GET /api/v1/commercial/client-documents/[id]` — Award/LOA/PO document detail & retrieval.

4. **Permissions**:
   - Added `precontract.conversion.recordResponse`, `precontract.conversion.execute` under `SUPER_ADMIN` and `ADMIN` in `apps/web/lib/permissions.ts`.

5. **Web UI**:
   - Integrated Client Response Recording Modal & Award Document Uploader into Proposal Detail UI at `/commercial/proposals/[id]`.
   - Built dedicated Contract Conversion Wizard at `/commercial/contract-conversion/[id]` with real-time readiness gates and atomic creation redirect to `/manpower/contracts`.

6. **Automated Testing & Build Verification**:
   - Created executable API test suite `tests/api/cl5-contract-conversion.spec.ts` (**8/8 tests pass, 100% pass, exit 0**).
   - `npx prisma validate`: **PASS (exit 0)**
   - `npx tsc --noEmit --project apps/web/tsconfig.json`: **PASS (exit 0)**
   - `npx tsc --noEmit --project apps/mobile/tsconfig.json`: **PASS (exit 0)**
   - `npm run build:workers`: **PASS (exit 0)**
   - `npm run build:web`: **PASS (exit 0)**
   - `npm run build:mobile`: **PASS (exit 0)**

7. SECFAC remains **PAUSED BY CIO**.

CL-5 Status:

`FULLY VERIFIED LOCALLY — COMMITTED d8b95d9 AND PUSHED TO REMOTE`

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

Never use `pm2 restart all`.

Only restart these approved named processes:

* `ahh-wfm-web-dev`
* `ahh-wfm-mobile-dev`
* `ahh-wfm-manpower-reconciliation-worker-dev`
* `ahh-wfm-secfac-evaluation-worker-dev`
* `ahh-wfm-secfac-monitoring-worker-dev`
* `ahh-wfm-secfac-notification-worker-dev`

---

## 4. Mandatory conversation continuity rule

1. If the context window approaches token limits, NEVER clear, delete or truncate the conversation history.
2. Create a structured continuation handoff carrying forward the complete authoritative project state under the SAME `AHH WFM Project`.
3. Conversation branching is NOT Git branching. Continue using approved Git branch `manpower-operations-scope`.

---

## 5. Functional LOCAL status

The following Commercial Lifecycle (CL-1 through CL-5) functionality is visible and working in the LOCAL Web application:

* Commercial > Opportunities (`/commercial/opportunities`)
* Commercial > Site Surveys (`/commercial/surveys`)
* Commercial > Cost Estimates (`/commercial/costing`)
* Commercial > Quotations & Proposals (`/commercial/quotations` and `/commercial/proposals/[id]`)
* Contract Conversion Console (`/commercial/contract-conversion/[id]`)
* Manpower Contracts Register (`/manpower/contracts`)

---

## 6. Accepted verification baseline

### CL-5 focused suite baseline

```text
Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
Snapshots:   0 total
Time:        ~10 s
Exit code:   0
```

### Mandatory verification gates (all passed)

1. Prisma schema validation (`npx prisma validate --schema packages/database/prisma/schema.prisma`): `PASS (exit 0)`
2. Web TypeScript check (`npx tsc --noEmit --project apps/web/tsconfig.json`): `PASS (exit 0)`
3. Mobile TypeScript check (`npx tsc --noEmit --project apps/mobile/tsconfig.json`): `PASS (exit 0)`
4. Workers build (`npm run build:workers`): `PASS (exit 0)`
5. CL-5 Jest suite (`npx jest --config=tests/jest.api.config.js tests/api/cl5-contract-conversion.spec.ts --runInBand`): `PASS (8/8, exit 0)`
6. Next.js Web Build (`npm run build:web`): `PASS (exit 0)`
7. Next.js Mobile Build (`npm run build:mobile`): `PASS (exit 0)`
8. Git repository status (`git status --short`): `CLEAN (exit 0)`
9. Git push to remote (`git push origin manpower-operations-scope`): `SUCCESS`

---

## 7. Authoritative migration inventory

| Migration name | Status | Notes |
|---|---|---|
| `20260810100000_add_cl5_client_acceptance_contract_conversion` | Applied (LOCAL) | Adds `PreContractClientResponse` table + 6 audit fields & FKs on `ManpowerContract` |
| `20260809153000_add_cl4_precontract_proposals` | Applied (LOCAL & SERVER) | Deployed on SERVER in release `14fb15a` |
| `20260809130000_add_cl3_precontract_costing` | Applied (LOCAL & SERVER) | Deployed on SERVER |
| (All prior migrations) | Applied (LOCAL & SERVER) | Unchanged |

Server migration status for `20260810100000_add_cl5_client_acceptance_contract_conversion`: **NOT YET APPLIED** (deployment blocked).

---

## 8. Current blocking issues

SERVER deployment remains blocked by the following:

1. Deployment requires explicit CIO authorization to move from `BLOCKED` to `DEPLOYMENT APPROVED`.

2. `20260810100000_add_cl5_client_acceptance_contract_conversion` migration has not been applied on SERVER.

---

## 9. Deployment approval state

Current state:

`DEPLOYMENT BLOCKED`

No SERVER deployment commands are approved.

No PM2 restart is approved.
