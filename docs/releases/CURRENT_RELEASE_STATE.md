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

* Commercial Command Center Phase CCC-0 Programme, Phase CCC-1 Operational Health, Phase CCC-2 Roster Coverage & Reliever Readiness Console, Phase CCC-3 Operational Escalation Queue & Workflow, Phase CCC-4 Commercial Health / Contract / SLA Analytics

* Commercial Command Center Phase CCC-5 Executive Wallboard / Control-Room View

* SECFAC Phase 6A.2 schema reconciliation (SECFAC Status: PAUSED BY CIO)

Current release objective:

1. Implement Commercial Command Center Phase CCC-5 Executive Wallboard / Control-Room View (`/commercial/command-center/wallboard`, canonical API `GET /api/v1/commercial/command-center/wallboard`).

2. Extract shared server domain helpers: `attendance-helpers.ts` (CCC-1), `roster-coverage-helpers.ts` (CCC-2), `escalation-helpers.ts` (CCC-3), and `commercial-health-helpers.ts` (CCC-4), ensuring original CCC endpoints and Wallboard route consume shared functions without domain code duplication.

3. Wallboard API orchestrates shared aggregators in parallel via `Promise.all()`, applies company and operation scope isolation, and sets `Cache-Control: private, no-cache, no-store, must-revalidate`.

4. Wallboard Web UI features Executive Header, Primary KPI Cards, Operational Attendance Pulse, Executive Exception Queue Ticker, Commercial Portfolio Monitor, Fullscreen API, 30s auto-refresh, manual refresh, 60s stale data banner, and console drill-down buttons.

5. Enforce SECFAC pause (no SECFAC code, migrations, or workers modified).

6. Complete all mandatory verification gates (Prisma validate, tsc Web/Mobile, 5 Jest test suites / 105 tests passed, Web/Mobile production builds).

7. Deploy only after CIO / ChatGPT review and explicit deployment authorization.

CCC-1 Status:

`DEPLOYED AND CLOSED`

CCC-2 Status:

`DEPLOYED AND CLOSED`

CCC-3 Status:

`DEPLOYED AND CLOSED`

CCC-4 Status:

`DEPLOYED AND CLOSED`

CCC-5 Status:

`VERIFIED LOCALLY (105/105 TESTS PASSED, ALL 6 GATES PASSED)`

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

`724a344d5cff9d443e2e5cdbcae6a0d6edae64d1`

Required direct verification:

* LOCAL `git status --short`;

* SERVER `git status --short`;

* confirmation that LOCAL and REMOTE match;

* confirmation of whether SERVER is still on the stable baseline or another commit.

Current values:

| Item                | Value                          |
| ------------------- | ------------------------------ |
| LOCAL HEAD          | `724a344d5cff9d443e2e5cdbcae6a0d6edae64d1` (CCC-4 SLA caller override removal commit) |
| REMOTE HEAD         | `724a344d5cff9d443e2e5cdbcae6a0d6edae64d1` |
| SERVER HEAD         | `13e7b516dc0ede72dc61b4a8f7173a95b5bd0f78` |
| LOCAL working tree  | `CLEAN` |
| SERVER working tree | `CLEAN` |

---

## 5. Functional LOCAL status

The following CCC-4 functionality is visible and working in the LOCAL Web application:

* Commercial & SLA Health Console (`/commercial/command-center/commercial-health`);

* Commercial Command Center integration ("Commercial & SLA Health" nav header link & metric card action at `/commercial/command-center`);

* Portfolio Metric Scorecards (Active Contracts, Healthy, Attention, Critical, Average Coverage %, SLA Risk Count, Expiring Soon);

* Multi-Contract Health Register table supporting filtering by business date, operation scope (SG vs. FM), company, client, contract, site, health status, SLA risk, and expiry status;

* 5-Tab Contract Detail Drawer (Health & SLA Summary, Effective Requirement Breakdown, Roster & Reliever Coverage, Attendance & Reconciliation Exposure, Billing Support & Audit Drill-Downs);

* Corrective Drill-Down Navigation Links (`Contract Master`, `Roster Coverage`, `Escalation Queue`, `Reconciliation Console`).

---

## 6. Accepted verification baseline

### CCC-4 API baseline

The accepted CCC-4 API test matrix is:

```text
Test Suites: 1 passed, 1 total
Tests:       17 passed, 17 total
Snapshots:   0 total
Time:        12.171 s
Exit code:   0
```

### Full Command Center Suite baseline

```text
Test Suites: 4 passed, 4 total
Tests:       103 passed, 103 total
Snapshots:   0 total
Time:        17.646 s
Exit code:   0
```

### Mandatory CCC-4 verification gates

1. Prisma schema validation (`npx prisma validate`): `PASS (0 errors)`
2. Web TypeScript check (`npx tsc --noEmit --project apps/web/tsconfig.json`): `PASS (0 errors)`
3. Mobile TypeScript check (`npx tsc --noEmit --project apps/mobile/tsconfig.json`): `PASS (0 errors)`
4. CCC-4 Jest test matrix (`npx jest --config=tests/jest.api.config.js tests/api/commercial-command-center-ccc4.spec.ts`): `PASS (17/17 tests passed)`
5. Full Command Center test matrix (`npx jest --config=tests/jest.api.config.js tests/api/commercial-command-center*.spec.ts`): `PASS (103/103 tests passed)`
6. Web production build (`npm run build:web`): `PASS (Exit code 0)`
7. Mobile production build (`npm run build:mobile`): `PASS (Exit code 0)`
8. Local dev server HTTP verification (`http://localhost:3100/commercial/command-center/commercial-health`): `PASS (HTTP Status 200)`

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
