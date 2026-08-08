# AHH WFM — Current Release State

Last updated: August 8, 2026

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

* Commercial Command Center Phase CCC-0 Programme, Phase CCC-1 Operational Health, Phase CCC-2 Roster Coverage & Reliever Readiness Console

* SECFAC Phase 6A.2 schema reconciliation (SECFAC Status: PAUSED BY CIO)

Current release objective:

1. Finalize Commercial Lifecycle Phase CL-2 Pre-Contract Site Surveys & Audits (Web route `/commercial/surveys`, canonical APIs `GET/POST /api/v1/commercial/surveys`, `GET/PATCH /api/v1/commercial/surveys/[id]`, `POST /api/v1/commercial/surveys/[id]/workflow`).

2. Enforce Commercial Opportunity Eligibility Rule: Active opportunity cases (`DRAFT`, `IN_WORKFLOW`, `COMPLETED`) can create a Site Survey. Ineligible opportunity cases (`CANCELLED`, `SUPERSEDED`) return `400 Bad Request`.

3. Enforce Centralized Workflow Engine Governance (`Settings > Workflow Setup`) via `WorkflowInstance` and `WorkflowActionHistory` audit trails, including missing template rejection (400), approver role eligibility checks, multi-level progression, RETURN to DRAFT, REJECT to CANCELLED, and Segregation of Duties (SoD) enforcement.

4. Configuration-Driven Survey Workspace: Survey questions/sections loaded dynamically from `SurveyTemplateVersion` and saved as immutable `SurveyConfigurationSnapshot`.

5. Approved Survey Immutability & Re-Survey Revision Policy: Approved survey evidence (`COMPLETED`) is immutable (PATCH returns 400). Re-survey / revision creates a new `PreContractSurvey` record linked to the same opportunity case and prospective site.

6. Site Condition Configuration & Prospective Site Reuse: Reuses `SiteConditionConfiguration` master data and `PreContractProspectiveSite` records to prevent duplicate prospective site entries.

7. Pass 24-test expanded matrix in `tests/api/commercial-lifecycle-cl2.spec.ts` (24/24 passed).

8. Enforce SECFAC pause (no SECFAC code, migrations, or workers modified).

9. Complete all 6 mandatory verification gates (Prisma validate, tsc Web/Mobile, 24-test Jest spec, Web/Mobile production builds).

10. Deploy only after CIO / ChatGPT review and explicit deployment authorization.

CCC-1 Status:

`DEPLOYED AND CLOSED (LOCAL HEAD LINEAGE)`

CCC-2 Status:

`DEPLOYED AND CLOSED (LOCAL HEAD LINEAGE)`

CL-1 Status:

`DEPLOYED AND CLOSED (COMMITTED & PUSHED)`

CL-2 Status:

`VERIFIED LOCALLY (24/24 TESTS PASSED, ALL 6 GATES PASSED)`

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

Current release baseline:

`71befcb65dac7040b2ee67abc22bf5f39d21b6d0`

Required direct verification:

* LOCAL `git status --short`;

* SERVER `git status --short`;

* confirmation that LOCAL and REMOTE match;

* confirmation of whether SERVER is still on the stable baseline or another commit.

Current values:

| Item                | Value                          |
| ------------------- | ------------------------------ |
| LOCAL HEAD          | `71befcb65dac7040b2ee67abc22bf5f39d21b6d0` |
| REMOTE HEAD         | `71befcb65dac7040b2ee67abc22bf5f39d21b6d0` |
| SERVER HEAD         | `13e7b516dc0ede72dc61b4a8f7173a95b5bd0f78` |
| LOCAL working tree  | `CL-2 UNCOMMITTED CHANGES` |
| SERVER working tree | `CLEAN` |

---

## 5. Functional LOCAL status

The following CL-2 functionality is visible and working in the LOCAL Web application:

* Pre-Contract Site Surveys & Audits Console (`/commercial/surveys`);

* Commercial Opportunities integration ("Site Surveys" nav link & "Create / View Site Survey" card action at `/commercial/opportunities`);

* KPI Scorecards (Total Surveys, Drafts, In Workflow, Approved);

* Survey Register table with search, lifecycle filter, operation type filter;

* Create Site Survey modal with opportunity case eligibility check & prospective site reuse;

* 5-Tab Survey Workspace Drawer (Site Context, Configured Survey Form, Site Condition Register, Evidence, Governance & Audit Log);

* Centralized Workflow Action Modal (`SUBMIT`, `APPROVE`, `RETURN`, `REJECT`) bound to `Settings > Workflow Setup`.

---

## 6. Accepted verification baseline

### CL-2 API baseline

The accepted CL-2 API test matrix is:

```text
Test Suites: 1 passed, 1 total
Tests:       24 passed, 24 total
Snapshots:   0 total
Time:        11.433 s
Exit code:   0
```

### Mandatory CL-2 verification gates

1. Prisma schema validation (`npx prisma validate`): `PASS (0 errors)`
2. Web TypeScript check (`npx tsc --noEmit --project apps/web/tsconfig.json`): `PASS (0 errors)`
3. Mobile TypeScript check (`npx tsc --noEmit --project apps/mobile/tsconfig.json`): `PASS (0 errors)`
4. CL-2 Jest test matrix (`npx jest --config=tests/jest.api.config.js tests/api/commercial-lifecycle-cl2.spec.ts --runInBand`): `PASS (24/24 tests passed)`
5. Web production build (`npm run build:web`): `PASS (Exit code 0)`
6. Mobile production build (`npm run build:mobile`): `PASS (Exit code 0)`

---

## 7. Current blocking issues

SERVER deployment remains blocked by the following:

1. Deployment requires explicit CIO authorization to move from `BLOCKED` to `DEPLOYMENT APPROVED`.

---

## 8. Deployment approval state

Current state:

`DEPLOYMENT BLOCKED`

No SERVER deployment commands are approved.

No PM2 restart is approved.
