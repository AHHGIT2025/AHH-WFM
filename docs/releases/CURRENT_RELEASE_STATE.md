\# AHH WFM — Current Release State

Last updated: August 5, 2026

Timezone: Asia/Qatar

Repository: `AHHGIT2025/AHH-WFM`

Primary branch: `manpower-operations-scope`

This document contains the changing release state for the AHH WFM project.

Permanent project rules are defined in the repository root:

`AGENTS.md`

When this file conflicts with an older conversation, walkthrough or report, use the newest directly verified repository, database and SERVER evidence.

Do not store passwords, API keys, tokens, connection strings, `.env` values or sensitive employee/client data in this file.

\---

\## 1. Release identity

Current programme:

\* Commercial \& Contracts lifecycle foundation

\* PC-2A Commercial Cost Master administration

\* CL-0 Commercial \& Contracts navigation and visual foundation

\* SECFAC Phase 6A.2 schema reconciliation required by the current application code

Current release objective:

1\. Establish one valid Prisma migration chain.

2\. Preserve existing approved Commercial, SECFAC and manpower functionality.

3\. reconcile the actual SERVER database history safely.

4\. achieve a normal fresh-database migration deployment.

5\. complete all required verification gates.

6\. deploy only after ChatGPT reviews the final AG walkthrough and explicitly approves deployment.

CL-1 is not approved.

Do not begin CRM, Opportunities or another Commercial phase until the current migration and release work is completed and approved.

Deployment approval state:

`BLOCKED`

\---

\## 2. Project paths and URLs

\### LOCAL

Repository:

`D:\\AI Projects\\AHH WFM\\app`

Web:

`http://localhost:3100`

Mobile:

`http://localhost:3101`

\### SERVER

Repository:

`D:\\Apps\\AHH-WFM\\dev`

Web:

`http://10.10.50.24:3200`

Mobile:

`http://10.10.50.24:3201`

\---

\## 3. Approved SERVER process names

Only the following PM2 processes may be used:

\* `ahh-wfm-web-dev`

\* `ahh-wfm-mobile-dev`

\* `ahh-wfm-manpower-reconciliation-worker-dev`

\* `ahh-wfm-secfac-evaluation-worker-dev`

\* `ahh-wfm-secfac-monitoring-worker-dev`

\* `ahh-wfm-secfac-notification-worker-dev`

Never run:

`pm2 restart all`

Any process temporarily stopped to release a Windows Prisma DLL lock must be restarted before deployment completion.

\---

\## 4. Branch and commit state

Branch:

`manpower-operations-scope`

Latest reported candidate correction commit:

`d8ba591`

The abbreviated hash is not sufficient for release or deployment approval.

Required direct verification:

\* full 40-character LOCAL HEAD;

\* full 40-character REMOTE HEAD;

\* full 40-character SERVER HEAD;

\* LOCAL `git status --short`;

\* SERVER `git status --short`;

\* confirmation that LOCAL and REMOTE match;

\* confirmation of whether SERVER is still on the stable baseline or another commit.

Current values:

| Item                | Value                          |

| ------------------- | ------------------------------ |

| LOCAL HEAD          | `REQUIRES DIRECT VERIFICATION` |

| REMOTE HEAD         | `REQUIRES DIRECT VERIFICATION` |

| SERVER HEAD         | `REQUIRES DIRECT VERIFICATION` |

| LOCAL working tree  | `REQUIRES DIRECT VERIFICATION` |

| SERVER working tree | `REQUIRES DIRECT VERIFICATION` |

Previously reported verified commit:

`bae9ec2`

The full 40-character value was not included in the final evidence.

Because migration files were subsequently added at the reported `d8ba591` candidate, verification results from `bae9ec2` cannot by themselves approve the newer candidate.

\---

\## 5. Functional LOCAL status

The following CL-0 functionality has been reported as visible and working in the LOCAL Web application:

\* Commercial \& Contracts sidebar section;

\* Security Guarding Contract redirect;

\* Facility Management Contract redirect;

\* Commercial Cost Configuration entry under Settings;

\* route `/settings/commercial-contract/cost-configuration`;

\* Categories tab;

\* Elements tab;

\* Drivers tab;

\* Allocation Methods tab;

\* Rate Cards tab;

\* Formula Definitions tab;

\* Packages tab;

\* Version History tab;

\* ADMIN access;

\* SUPER\_ADMIN access;

\* secure access-denied behavior for unauthorized users.

Permission keys reported for the Cost Configuration feature:

\* `precontract.costConfig.view`

\* `precontract.costConfig.manage`

The existing Contract module remains the authoritative contract source.

The CL-0 foundation must not create a duplicate or competing Contract master.

Current visual status:

`LOCALLY REPORTED AS PASSING — MUST BE RECONFIRMED IF RELEVANT UI FILES CHANGE`

\---

\## 6. Accepted verification baseline

\### Full API baseline

The accepted full API baseline is:

```text

Test Suites: 1 skipped, 49 passed, 49 of 50 total

Tests:       9 skipped, 958 passed, 967 total

Snapshots:   0 total

Exit code:   0

```

The existing skipped suite and nine skipped tests must not increase without explicit approval.

\### Previously reported passing gates

The following gates were reported as passing before the latest migration-chain changes:

\* Prisma schema validation;

\* Prisma Client generation;

\* Web TypeScript;

\* Mobile TypeScript;

\* Worker TypeScript;

\* database tests;

\* focused SECFAC tests;

\* focused PC-2A tests;

\* full API suite;

\* Web build;

\* Mobile build;

\* LOCAL browser verification.

Accepted-evidence freeze rule:

Do not rerun an accepted gate unless a relevant tracked file changed after the accepted commit.

However, migration files were reportedly added after commit `bae9ec2`. Therefore, the final candidate must repeat all migration-sensitive gates and any other gate affected by the changed files.

\---

\## 7. Authoritative migration inventory

The final migration inventory is not yet approved.

The latest reported candidate includes these PC-2A and reconciliation migrations:

\* `20260801000000\_pc2a\_clean`

\* `20260802160000\_pc2a\_scoped\_additive`

\* `20260803120000\_secfac\_welfare\_reconciliation`

\* `20260803150000\_secfac\_schema\_drift\_repair`

Historical migration involved in the incident:

\* `20260730063056\_pc2a\_cost\_master\_admin`

Current inventory status:

`REQUIRES DIRECT REPOSITORY VERIFICATION`

Required evidence:

\* exact migration folders present in LOCAL;

\* exact migration folders present in REMOTE;

\* exact migration folders present on SERVER;

\* introducing commit for each migration;

\* modifying commit for each migration;

\* deleting commit where applicable;

\* checksum of every relevant migration file.

Do not describe this inventory as authoritative until these checks are completed.

\---

\## 8. PC-2A migration incident

The PC-2A migration history has produced conflicting reports involving:

\* deleted migration SQL;

\* raw SQL reportedly applied directly to the SERVER;

\* partially failed migrations;

\* missing Commercial foreign keys;

\* differing foreign-key delete rules;

\* reconstructed migration folders;

\* test-database migration rows being confused with SERVER rows;

\* non-empty Prisma diffs being described as expected;

\* possible duplicate executable DDL between `pc2a\_clean` and `pc2a\_scoped\_additive`.

Previously observed migration names include:

\* `20260730063056\_pc2a\_cost\_master\_admin`

\* `20260801000000\_pc2a\_clean`

\* `20260802160000\_pc2a\_scoped\_additive`

The exact live SERVER migration requiring recovery is:

`REQUIRES DIRECT SERVER VERIFICATION`

The exact live SERVER migration checksum is:

`REQUIRES DIRECT SERVER VERIFICATION`

The exact live SERVER failure log is:

`REQUIRES DIRECT SERVER VERIFICATION`

Do not run `prisma migrate resolve` until the exact live migration row is confirmed.

\---

\## 9. Commercial foreign-key recovery state

The recovery investigation has referenced these six relationships:

1\. `CostCategoryMaster.costConfigurationVersionId`

2\. `CostConfigurationVersion.headerId`

3\. `CostDriverMapping.versionId`

4\. `CostElementMaster.versionId`

5\. `CostFormulaDefinition.versionId`

6\. `CostRateMaster.versionId`

For final approval, direct SERVER evidence must report for each:

\* source table existence;

\* source column existence;

\* foreign-key existence;

\* exact constraint name;

\* referenced table and column;

\* update rule;

\* delete rule;

\* orphan count.

The latest walkthrough reported differences between `RESTRICT` and `SET NULL` for:

\* `CostElementMaster.versionId`

\* `CostFormulaDefinition.versionId`

The approved final rules must match the Prisma schema and business intent.

Current six-FK state:

`REQUIRES DIRECT SERVER VERIFICATION`

\---

\## 10. SECFAC schema reconciliation

The current application code reportedly depends on these fields:

\### `SecFacWelfareSetting`

\* `postId`

\### `SecfacEvidenceAttachment`

\* `clientCapturedAt`

\* `deviceSessionId`

\* `integrityFlags`

\* `serverReceivedAt`

\### `SecfacPatrolExecution`

\* `evaluationRunId`

\### `SecfacPatrolExecutionCheckpoint`

\* `exceptionAcknowledgedBy`

\* `evaluationRunId`

Legacy compatibility fields previously identified include:

\* `RosterSlotAssignment.assignedRosterType`

\* `SecFacWelfareSetting.sourceType`

\* `SecfacPatrolExecution.lastEvaluatedAt`

\* `SecfacPatrolExecutionCheckpoint.exceptionAcknowledgedById`

Legacy fields must not be dropped without a separately approved cleanup release.

Reported reconciliation migration:

`20260803120000\_secfac\_welfare\_reconciliation`

Reported broader repair migration:

`20260803150000\_secfac\_schema\_drift\_repair`

The broader migration reportedly affects:

\* SECFAC welfare tables;

\* patrol tables;

\* evidence tables;

\* `SecfacPatrolRoute`;

\* `RosterSlotAssignment`;

\* Commercial cost foreign keys;

\* FK-backing indexes.

Because this crosses SECFAC, manpower and Commercial boundaries, every statement requires explicit scope classification and data-safety evidence.

Current reconciliation approval:

`NOT APPROVED FOR SERVER DEPLOYMENT`

\---

\## 11. Fresh-database migration requirement

The final committed migration chain must succeed on a completely empty MySQL database using only:

```powershell

npx prisma migrate deploy --schema packages/database/prisma/schema.prisma

```

The fresh-database proof must not use:

\* raw SQL pre-application;

\* `prisma migrate resolve`;

\* manually created tables or columns;

\* skipped migrations;

\* manually inserted migration rows;

\* manual `\_prisma\_migrations` changes.

Required result:

\* every committed migration applies in timestamp order;

\* exit code 0;

\* `prisma migrate status` reports up to date;

\* no duplicate table, column, index or constraint errors;

\* final Prisma schema diff is genuinely empty;

\* no generated SQL remains;

\* no migration checksum warning;

\* no missing or modified migration warning.

Current fresh-chain status:

`REQUIRES VERIFICATION`

The reported presence of both:

\* `20260801000000\_pc2a\_clean`

\* `20260802160000\_pc2a\_scoped\_additive`

creates a possible duplicate-DDL risk.

The migration overlap must be audited before implementation or deployment continues.

\---

\## 12. Database simulation requirements

The final release must pass three separate simulations.

\### Database A — Empty fresh database

Required:

\* normal migration deployment only;

\* no resolve commands;

\* complete migration inventory;

\* exit code 0;

\* status up to date;

\* empty final diff.

Status:

`REQUIRES VERIFICATION FOR FINAL MIGRATION CHAIN`

\### Database B — Populated stable baseline

Required representative data:

\* Commercial legacy records;

\* welfare checks;

\* welfare settings;

\* evidence attachments;

\* patrol executions;

\* patrol checkpoints;

\* legacy compatibility columns.

Required:

\* zero record loss;

\* safe idempotency backfill;

\* valid enum values;

\* valid foreign keys;

\* legacy fields preserved;

\* status up to date;

\* empty final diff.

Status:

`REQUIRES VERIFICATION FOR FINAL MIGRATION CHAIN`

\### Database C — Exact SERVER failure state

Required:

\* exact live SERVER migration name;

\* exact live checksum;

\* exact failure log;

\* exact partial DDL state;

\* exact missing constraints;

\* exact applied-steps state;

\* normal Prisma failure reproduction;

\* approved recovery;

\* no manual `\_prisma\_migrations` edits;

\* final status up to date;

\* empty final diff.

Status:

`REQUIRES EXACT SERVER-BASED REPRODUCTION`

\---

\## 13. Current blocking issues

SERVER deployment is blocked by the following:

1\. Full candidate commit hashes have not been provided.

2\. Actual SERVER HEAD requires direct verification.

3\. Actual live SERVER migration rows require direct verification.

4\. The exact failed SERVER migration identity remains disputed.

5\. Possible duplicate executable DDL exists between:

&#x20;  \* `20260801000000\_pc2a\_clean`

&#x20;  \* `20260802160000\_pc2a\_scoped\_additive`

6\. A true empty-database migration deployment has not yet been accepted for the latest chain.

7\. The latest SECFAC drift-repair migration crosses multiple release boundaries.

8\. Data-safety evidence is required for required-column, enum, foreign-key and index changes.

9\. Literal empty Prisma diffs are required for Databases A, B and C.

10\. Mandatory verification gates must be rerun if the latest migration files remain changed.

11\. The final Git working tree must be clean.

12\. ChatGPT has not approved deployment.

\---

\## 14. Prohibited actions during the blocked state

Until deployment is approved, do not:

\* deploy to SERVER;

\* run `prisma migrate deploy` on the live SERVER;

\* run `prisma migrate resolve` on the live SERVER;

\* apply raw SQL to the live SERVER;

\* edit `\_prisma\_migrations`;

\* restart SERVER processes;

\* begin CL-1;

\* modify migrations to bypass errors without review;

\* describe a non-empty schema diff as acceptable;

\* use test database evidence as SERVER evidence.

Never run:

\* `prisma db pull`

\* `prisma db push`

\* `prisma migrate reset`

\* `git add .`

\* `pm2 restart all`

\* custom `run\_jest\_tests.js`

\---

\## 15. Approved next task

The approved next action is:

`PC-2A MIGRATION CHAIN READ-ONLY DECISION AUDIT`

The task must:

1\. inspect LOCAL and SERVER Git states;

2\. inspect actual live SERVER migration rows;

3\. compare `pc2a\_clean` and `pc2a\_scoped\_additive` statement by statement;

4\. inspect the live Commercial schema;

5\. classify the SECFAC drift-repair migration;

6\. recommend one valid migration-chain design;

7\. make no file changes;

8\. run no builds or tests;

9\. perform no migration or SERVER write.

The task must end with:

`MIGRATION CHAIN DECISION READY`

or:

`MIGRATION CHAIN DECISION REQUIRES CIO INPUT`

After that audit, stop for CIO and ChatGPT review.

\---

\## 16. Final release gates

Before deployment approval, the final candidate must provide:

\### Repository and Git

\* full correction commit;

\* full LOCAL HEAD;

\* full REMOTE HEAD;

\* full SERVER HEAD;

\* empty LOCAL `git status --short`;

\* verified migration inventory.

\### Prisma and migration

\* Prisma validate;

\* Prisma generate;

\* true fresh-database migration deploy;

\* populated baseline simulation;

\* exact SERVER-failure simulation;

\* migration status;

\* literal empty diffs;

\* no checksum warnings;

\* no unresolved failed migration.

\### TypeScript

\* Web TypeScript;

\* Mobile TypeScript;

\* Worker TypeScript.

\### Tests

\* focused SECFAC tests;

\* focused PC-2A tests;

\* database tests;

\* full API baseline:

&#x20; \* 49 passed suites;

&#x20; \* 958 passed tests;

&#x20; \* nine documented skips;

&#x20; \* exit code 0.

\### Builds

\* Web build;

\* Mobile build;

\* BUILD\_ID or equivalent build-output verification.

\### Visual verification

\* Commercial \& Contracts sidebar;

\* Security Guarding Contract redirect;

\* Facility Management Contract redirect;

\* Cost Configuration navigation;

\* Cost Configuration route;

\* all tabs;

\* ADMIN;

\* SUPER\_ADMIN;

\* unauthorized-user behavior;

\* no console errors;

\* no unexpected failed API requests.

\### Release

\* clean Git state;

\* LOCAL and REMOTE match;

\* final AG walkthrough;

\* ChatGPT release verdict;

\* explicit `DEPLOYMENT APPROVED`.

\---

\## 17. Deployment approval state

Current state:

`DEPLOYMENT BLOCKED`

No SERVER deployment commands are approved.

No migration recovery command is approved.

No PM2 restart is approved.

When all gates pass, ChatGPT will provide the complete SERVER deployment command sequence with:

\* exact approved commit;

\* exact migration recovery;

\* named process stops;

\* dependency installation;

\* Prisma Client generation;

\* migration deployment;

\* Web and Mobile builds;

\* named process restarts;

\* SERVER health verification;

\* runtime API verification;

\* PM2 status;

\* targeted logs;

\* final deployed commit verification.

\---

\## 18. Last verified date

Last release-state update:

`August 5, 2026`

Last updated by:

`CIO/Product Owner and ChatGPT review`

Next mandatory update:

After completion of the read-only migration-chain decision audit.
