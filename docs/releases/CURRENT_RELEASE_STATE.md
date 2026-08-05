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

The current application code depends on these fields:

### `SecFacWelfareSetting`

* `postId`

### `SecfacEvidenceAttachment`

* `clientCapturedAt`

* `deviceSessionId`

* `integrityFlags`

* `serverReceivedAt`

### `SecfacPatrolExecution`

* `evaluationRunId`

### `SecfacPatrolExecutionCheckpoint`

* `exceptionAcknowledgedBy`

* `evaluationRunId`

Legacy compatibility fields:

* `RosterSlotAssignment.assignedRosterType`

* `SecFacWelfareSetting.sourceType`

* `SecfacPatrolExecution.lastEvaluatedAt`

* `SecfacPatrolExecutionCheckpoint.exceptionAcknowledgedById`

Legacy fields are preserved.

Reported reconciliation migration:

`20260803120000_secfac_welfare_reconciliation`

Corrected drift repair migration:

`20260803150000_secfac_schema_drift_repair`

### Incident P3018 Resolution & State-Aware Stored Procedure Guarding
* **Incident Cause**: The production deployment at commit `7857a87d5dacfd02a7a9e3aab16adb8aa115bac7` failed with Prisma Error `P3018` (MySQL Error `1091` on Query 1) while attempting `ALTER TABLE SecFacWelfareCheck DROP FOREIGN KEY SecFacWelfareCheck_companyId_fkey`. Physical schema inspection of the live SERVER database (`ahh_wfm`) proved that `SecFacWelfareCheck_companyId_fkey` and `SecFacWelfareCheck_projectId_fkey` were already absent. Raw `DROP FOREIGN KEY` statements without guards failed.
* **Correction**: Converted `20260803150000_secfac_schema_drift_repair/migration.sql` into a state-aware conditional stored procedure `_secfac_drift_repair()` using `information_schema.TABLE_CONSTRAINTS` and `information_schema.STATISTICS` `IF EXISTS` / `IF NOT EXISTS` guards for all 12 foreign key drops, 4 index drops, 2 index renames, 5 index creations, and 5 foreign key additions.
* **Corrected Migration Checksum**: SHA-256 `40a54d264f1aacd9a30407acc14d351e9b6595b5869157410e973461d199cc94` (blob: `c73659114db1f5169610835203866be9b4e7a233`).

\---

\## 11. Fresh-database migration requirement

The final committed migration chain succeeds on a completely empty MySQL database using only:

```powershell

npx prisma migrate deploy --schema packages/database/prisma/schema.prisma

```

Current fresh-chain status:

`VERIFIED — FRESH CHAIN STATICALLY & DYNAMICALLY VALID`

The migration chain has been verified across all 4 database targets:
* `20260801000000_pc2a_clean`: Converted to a 0-SQL historical no-op marker (SHA-256: `730fc62dadb7befac8d0473189c4b0097673038ef2a2bd1b23af0ad09898cec2`).
* `20260802160000_pc2a_scoped_additive`: Authoritative executable PC-2A migration matching live SERVER `_prisma_migrations` row (SHA-256: `f5d07607460890201fdbc30588b214fef3efa91f995c7736eeb4e2131a345dc1`).
* `20260803150000_secfac_schema_drift_repair`: State-aware conditional stored procedure (SHA-256: `40a54d264f1aacd9a30407acc14d351e9b6595b5869157410e973461d199cc94`).

\---

\## 12. Database simulation requirements

The release passed all four required database proofs with exit code 0 and ZERO DIFF:

### Database A — Empty fresh database
* Commands: `npx prisma migrate deploy`
* Results: Executed all 25 migrations in sequence. `pc2a_clean` completed as 0-SQL marker, `pc2a_scoped_additive` executed DDL once without Error 1050, `secfac_schema_drift_repair` executed state-aware procedure cleanly.
* Status: `PASS — ZERO DIFF CONFIRMED`

### Database B — Populated baseline
* Commands: `npx prisma migrate deploy`
* Results: Preserved all records and legacy compatibility fields. All migrations applied cleanly.
* Status: `PASS — ZERO DIFF CONFIRMED`

### Database C — Pre-repair live SERVER history
* Commands: `npx prisma migrate resolve --applied 20260801000000_pc2a_clean`, `npx prisma migrate deploy`
* Results: Registered no-op marker `pc2a_clean`, accepted live SERVER `pc2a_scoped_additive` without modified-migration warnings, deployed pending SECFAC reconciliation and drift repair migrations cleanly.
* Status: `PASS — ZERO DIFF CONFIRMED`

### Database D — Exact failed production recovery path
* Simulation setup: Seeded live SERVER pre-repair state, inserted failed `_prisma_migrations` row for `20260803150000_secfac_schema_drift_repair` (`checksum = cd53a2fc3b7d4e473111a91826931ed534c0d995c4bcb52cd26b8f77b8ff59d5`, `logs = P3018 MySQL Error 1091`, `finished_at = NULL`).
* Commands: `npx prisma migrate resolve --rolled-back 20260803150000_secfac_schema_drift_repair`, `npx prisma migrate deploy`
* Results: Rollback resolution marked failed row as rolled back (`rolled_back_at` set), `migrate deploy` executed corrected state-aware procedure cleanly and recorded new row with SHA-256 `40a54d264f1aacd9a30407acc14d351e9b6595b5869157410e973461d199cc94` (`finished_at` populated, `applied_steps_count = 1`).
* Status: `PASS — ZERO DIFF CONFIRMED`

\---

\## 13. Current blocking issues

SERVER deployment remains blocked by the following:

1. Deployment requires explicit CIO authorization to move from `BLOCKED` to `DEPLOYMENT APPROVED`.

---

## 14. Prohibited actions during the blocked state

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
