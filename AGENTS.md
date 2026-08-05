# AGENTS.md — AHH WFM Agent Operating Manual

## 1. Project identity

Project: AHH WFM
Organization: Al Hattab Holding
Repository: `AHHGIT2025/AHH-WFM`
Primary branch: `manpower-operations-scope`

LOCAL development workspace:

`D:\AI Projects\AHH WFM\app`

SERVER deployment workspace:

`D:\Apps\AHH-WFM\dev`

LOCAL URLs:

* Web: `http://localhost:3100`
* Mobile: `http://localhost:3101`

SERVER URLs:

* Web: `http://10.10.50.24:3200`
* Mobile: `http://10.10.50.24:3201`

Technology stack:

* Next.js monorepo
* `apps/web`
* `apps/mobile`
* Prisma and MySQL under `packages/database`
* `packages/mock-data`
* `packages/types`
* `packages/ui`
* PM2-managed Web, Mobile and worker processes

Before every task, read:

`docs/releases/CURRENT_RELEASE_STATE.md`

That file contains the authoritative current branch, release commit, migration status, accepted verification gates, known blockers and deployment approval state.

Do not rely on conversation history when the release-state file provides newer evidence.

---

## 2. CIO and agent execution structure

The user is the CIO/Product Owner.

Use this delivery structure:

CIO/Product Owner
→ Architect Agent
→ Business Rule Agent
→ Database/API Agent, Web Agent, Mobile Agent and Security Agent in parallel where relevant
→ Test Agent
→ Documentation Agent
→ Release Agent
→ DevOps Agent

The Architect Agent coordinates the task.

The Business Rule Agent validates business rules before implementation.

Implementation agents must not redefine approved business rules independently.

Testing, documentation, release and deployment must occur only after implementation gates pass.

---

## 3. Mandatory LOCAL and SERVER separation

Every command block must be labeled exactly one of:

* `RUN ON LOCAL`
* `RUN ON SERVER`

Do not use `RUN ON BOTH`.

### LOCAL responsibilities

Use LOCAL for:

* repository inspection;
* architecture inspection;
* code implementation;
* Prisma schema work;
* migration authoring;
* database simulations;
* unit and integration tests;
* browser and UI verification;
* Web and Mobile builds;
* documentation;
* Git commit;
* Git push.

### SERVER responsibilities

Use SERVER only for:

* read-only SERVER inspection;
* fetching an approved commit;
* resetting to an approved remote commit;
* installing committed dependencies;
* Prisma Client generation;
* approved migration recovery;
* `prisma migrate deploy`;
* SERVER builds;
* named PM2 process restart;
* HTTP verification;
* runtime log inspection.

Never implement source code directly in:

`D:\Apps\AHH-WFM\dev`

Never create migrations directly on the SERVER.

Never use a test database result as proof of actual SERVER state.

---

## 4. One-task execution rule

Every AG task has one primary objective.

Perform only that objective.

Do not automatically expand a task into:

* unrelated cleanup;
* architecture redesign;
* another project phase;
* broad schema formatting;
* migration regeneration;
* full regression testing;
* Git release;
* SERVER deployment.

Do not begin another phase unless the CIO explicitly approves it.

At the end of each task, stop and wait for review.

Do not automatically begin the next task.

---

## 5. Repository-first and delta-only rule

Before implementing any phase, enhancement or correction:

1. Read this `AGENTS.md`.
2. Read `docs/releases/CURRENT_RELEASE_STATE.md`.
3. Run `git status --short`.
4. Confirm the active branch.
5. Confirm full LOCAL and REMOTE hashes.
6. Inspect relevant documentation.
7. Inspect existing source files.
8. Inspect Prisma schema and migration history where relevant.
9. Inspect APIs, UI, workers and tests.
10. Inspect Git history for prior implementations.

Determine which requested features already exist.

Preserve existing working features.

Do not rebuild completed functionality.

Implement only confirmed gaps, defects or incomplete areas.

Every walkthrough must identify:

* what was reused;
* what was skipped;
* what was corrected;
* what was newly added.

---

## 6. Read-only before write

When the repository, database, migration history, business rules or SERVER state are uncertain, perform a read-only audit first.

Do not edit files during the read-only audit.

Stop immediately when any of the following occurs:

* migration identity conflict;
* checksum conflict;
* Git and database history disagreement;
* LOCAL and SERVER disagreement;
* missing table, column, index or foreign key;
* unexpected Prisma schema diff;
* unexpected Git modifications;
* missing required file;
* command timeout or hang;
* conflicting business rules;
* unclear data ownership;
* uncertain destructive impact.

Return the literal evidence.

Do not invent a workaround.

Do not select one migration identity from several possibilities without evidence.

Do not describe a non-empty schema diff as expected without listing and resolving every difference.

---

## 7. Evidence-source labels

Label every material technical finding as one of:

* `LOCAL REPOSITORY`
* `LOCAL DATABASE`
* `TEST DATABASE`
* `SERVER READ-ONLY`
* `SERVER WRITE`

A `TEST DATABASE` result is not `SERVER READ-ONLY` evidence.

A Git commit does not prove the physical database schema.

A Prisma model does not prove a physical column exists.

A successful TypeScript build does not prove a migration has been applied.

Return exact:

* branch names;
* full 40-character hashes;
* migration names;
* checksums;
* database identities;
* constraint names;
* timestamps;
* command exit codes;
* failure logs.

Do not use ambiguous language such as:

* “migration A or migration B”;
* “probably”;
* “expected drift”;
* “SERVER-like” when the actual SERVER was not inspected.

---

## 8. Accepted-evidence freeze rule

Once a verification gate passes, record:

* commit hash;
* exact command;
* exit code;
* literal result.

Do not rerun that gate unless a relevant tracked file changes afterward.

Examples:

* Do not rerun the full API suite for a documentation-only change.
* Do not rerun browser verification for an isolated migration-history audit.
* Do not rerun Web and Mobile builds when no production source, schema or dependency changed.
* Do not rerun a completed 958-test regression suite merely to reproduce the same evidence.

Focused tests must pass before full regression tests are executed.

The accepted API baseline is:

* `Test Suites: 1 skipped, 49 passed, 49 of 50 total`
* `Tests: 9 skipped, 958 passed, 967 total`
* exit code 0

The skipped suite and skipped-test count must not increase without CIO approval.

---

## 9. Command and token budget

Run only commands explicitly required for the current task.

Do not add broad:

* tests;
* builds;
* dependency installs;
* database recreation;
* browser automation;
* Git operations;
* deployment work.

Do not use custom combined test runners.

Do not use `run_jest_tests.js`.

Use direct commands with visible output and exit codes.

If a command hangs:

1. Stop the command.
2. Preserve current work.
3. Report the last visible output.
4. Identify the specific child process if necessary.
5. Do not repeatedly restart the same command.

Do not terminate unrelated processes such as Stitch MCP connections.

---

## 10. File-scope rule

Modify only the files explicitly approved in the current task.

If another file appears necessary, stop and report:

* exact file path;
* reason it is required;
* proposed change;
* expected runtime or migration impact.

Do not modify it until approved.

Avoid broad formatting, import reordering or whole-file rewriting.

A targeted Prisma correction must not rewrite thousands of unrelated lines.

Do not modify unrelated SECFAC, manpower, Commercial, Mobile or worker code while fixing another scope.

---

## 11. Prisma and migration safety

Never run:

* `prisma db pull`
* `prisma db push`
* `prisma migrate reset`
* automatic destructive migration generation
* broad `prisma format`
* manual `_prisma_migrations` updates

Do not modify an already applied migration unless an explicit controlled recovery plan has been approved.

Do not create two executable migrations containing duplicate DDL.

Do not add a migration merely to register SQL that was manually applied unless the complete fresh-database chain remains valid.

Every final committed migration chain must pass on a completely empty MySQL database using only:

`npx prisma migrate deploy --schema packages/database/prisma/schema.prisma`

The fresh-database test must not:

* pre-apply raw SQL;
* use `migrate resolve`;
* skip a migration;
* create schema objects manually;
* insert or update migration-history rows.

A SERVER recovery simulation must reproduce the exact live:

* migration name;
* checksum;
* failure log;
* partial DDL state;
* missing constraints;
* applied-steps state.

Do not simulate a different migration and describe it as exact SERVER recovery.

---

## 12. Database safety rules

Before changing a column to `NOT NULL`, prove:

* total row count;
* current null count;
* backfill method;
* post-backfill null count;
* duplicate count when uniqueness applies.

Before adding or restoring a foreign key, prove:

* source table exists;
* source column exists;
* referenced table exists;
* referenced column exists;
* orphan count is zero;
* approved update rule;
* approved delete rule.

Before changing an enum or data type, report:

* current physical type;
* proposed type;
* every distinct stored value;
* compatibility of every stored value;
* data-loss risk;
* runtime impact.

Do not remove legacy physical columns merely because current code does not use them.

Legacy cleanup requires a separate approved release.

Do not drop FK-backing indexes until proving that no active foreign key or important query depends on them.

---

## 13. Core business rules

These rules are mandatory unless explicitly changed by the CIO.

1. Workforce Directory is the employee master.
2. White Collar current duty comes from Employee Default Location.
3. Blue Collar current duty comes from Shift Planner or Deployment Worksite.
4. Security Guarding and Facility Management are separate operational scopes.
5. Security Guarding users must not access Facility Management data.
6. Facility Management users must not access Security Guarding data.
7. Cross-scope access is permitted only for explicitly authorized ADMIN or SUPER_ADMIN users.
8. Workflow configuration is centralized under `Settings > Workflow Setup`.
9. Addendum is allowed only for ACTIVE contracts.
10. DRAFT contracts may be viewed, edited, deleted or submitted.
11. APPROVED contracts may only be viewed or activated.
12. ACTIVE contracts may only be viewed, amended or terminated.
13. REJECTED contracts may be viewed, edited and resubmitted.
14. Existing modules must not be disturbed by new features.
15. Conflicts with existing business rules must be reported before implementation.
16. The existing Contract module remains authoritative.
17. Commercial modules may consume or redirect to Contract data but must not replace the authoritative Contract model with a giant consolidated object.

---

## 14. Workflow governance

All workflows for these areas must be configured exclusively through:

`Settings > Workflow Setup`

This applies to:

* Site Survey;
* Costing;
* Proposal;
* Client Acceptance;
* Contract Conversion;
* Variation;
* Addendum;
* post-award approvals.

Modules may consume assigned workflow definitions.

Modules must not contain:

* local workflow setup screens;
* hardcoded approvers;
* hardcoded approval thresholds;
* hardcoded transitions;
* local escalation rules.

Every workflow must preserve:

* segregation of duties;
* immutable approval history;
* returns and rejection history;
* escalation evidence;
* complete audit trail.

---

## 15. Facility Management boundary

Do not add CAFM or CMMS functionality.

Facility Management scope is limited to:

* manpower operations;
* field-service execution;
* cleaning and soft-services workflows;
* inspections;
* attendance;
* deployment;
* client service;
* billing support;
* related operational controls.

Do not add asset-centric maintenance, equipment lifecycle or CMMS modules.

---

## 16. SECFAC governance

Current SECFAC release status must be read from:

`docs/releases/CURRENT_RELEASE_STATE.md`

Do not hardcode an old SECFAC phase as the current phase inside this permanent file.

General SECFAC rules:

* Do not fabricate operational monitoring evidence.
* Do not fabricate historical pilot records.
* Do not alter genuine monitoring timestamps.
* Do not delete genuine operational evidence without an approved retention process.
* Do not enable external communication channels without explicit approval.
* Do not add deferred items into the current phase without CIO approval.

Deferred SECFAC items include:

* Client Portal;
* CCTV/VMS integration;
* Alarm Monitoring integration;
* Duress PIN;
* mock-location detection;
* device attestation.

---

## 17. UI and visual verification

Source-code presence is not sufficient.

New functionality must be visible and usable in the latest LOCAL build.

Verification must report:

* feature name;
* sidebar or Settings location;
* exact route;
* required role;
* required permission;
* operation-scope behavior;
* steps to access it;
* visible components;
* console errors;
* failed network requests;
* exact LOCAL URL.

After SERVER deployment, report the exact SERVER URL.

Use the approved shared application theme.

Enabled controls must have readable, high-contrast text and icons.

Disabled controls must use a readable neutral disabled state.

No button may appear blank because of dark text or icons on a dark background.

Reuse shared Button and theme components instead of one-off hardcoded colors.

---

## 18. Testing order

Use this sequence:

1. Prisma validation.
2. Prisma Client generation.
3. relevant TypeScript project checks;
4. focused database or API tests;
5. migration simulations;
6. database integrity tests;
7. full API suite;
8. Web build;
9. Mobile build;
10. browser verification.

Do not run the full suite before focused tests pass.

When required, run TypeScript separately for:

* Web;
* Mobile;
* Workers.

Do not report a generic `npx tsc --noEmit` as proof of all three required configurations.

---

## 19. Git safety rules

Before work:

```powershell
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse origin/manpower-operations-scope
git log -5 --oneline
```

Never use:

* `git add .`
* force push;
* destructive reset of unreviewed work;
* automatic cleanup of unrelated files.

Stage explicit files only.

Before completion return:

* focused commit hash;
* full LOCAL HEAD;
* full REMOTE HEAD;
* `git status --short`;
* confirmation that the status is empty.

Do not track:

* `.env` files;
* credentials;
* API keys;
* database dumps;
* test databases;
* temporary migration files;
* temporary worktrees;
* `.old` files;
* generated patches;
* temporary Prisma binaries.

---

## 20. Approved SERVER PM2 processes

Never use:

`pm2 restart all`

Use only these approved named processes:

* `ahh-wfm-web-dev`
* `ahh-wfm-mobile-dev`
* `ahh-wfm-manpower-reconciliation-worker-dev`
* `ahh-wfm-secfac-evaluation-worker-dev`
* `ahh-wfm-secfac-monitoring-worker-dev`
* `ahh-wfm-secfac-notification-worker-dev`

Stop and restart only processes required for the approved deployment.

Other named processes may be stopped temporarily only when necessary to release a Windows Prisma DLL lock.

Restart every temporarily stopped named process before completing deployment.

---

## 21. Deployment approval rules

Do not deploy unless the current task explicitly states:

`DEPLOYMENT APPROVED`

Do not provide SERVER deployment commands merely because implementation or tests passed.

The required flow is:

1. AG completes implementation and verification.
2. AG returns the walkthrough.
3. ChatGPT reviews the walkthrough.
4. If all release gates pass, ChatGPT provides the complete SERVER deployment command sequence.
5. If a correction is required, ChatGPT provides one consolidated correction prompt.
6. AG completes only that correction.
7. A new walkthrough is reviewed.

When deployment is approved, provide the complete sequence, including:

* repository verification;
* approved full commit hash;
* dependency installation;
* named process stop where needed;
* Prisma validation;
* Prisma Client generation;
* approved migration recovery;
* migration deployment;
* migration status;
* Web build;
* Mobile build;
* named process restart;
* LOCALHOST SERVER health checks;
* LAN URL checks;
* relevant API authentication checks;
* PM2 status;
* targeted logs;
* final deployed commit verification.

Do not provide partial deployment snippets.

---

## 22. Walkthrough response format

Every AG walkthrough must return:

1. Objective completed.
2. Evidence source labels.
3. Root cause.
4. Files changed.
5. Commands executed.
6. Exit code for every command.
7. Test results.
8. Migration and data impact.
9. UI location and access steps where applicable.
10. Remaining blockers.
11. Full Git hashes.
12. Clean or dirty Git state.

End with exactly one:

`TASK VERIFIED`

or:

`TASK REQUIRES CORRECTION`

Do not begin another task automatically.

---

## 23. Current release state maintenance

Changing release information must be stored in:

`docs/releases/CURRENT_RELEASE_STATE.md`

That file must include:

* current branch;
* current approved LOCAL commit;
* current REMOTE commit;
* current SERVER commit;
* authoritative migration inventory;
* actual live failed migration row, if any;
* approved recovery design;
* accepted test gates;
* accepted build gates;
* accepted visual gates;
* remaining blockers;
* deployment approval status.

Update that file only with verified evidence.

Do not include:

* passwords;
* connection strings;
* `.env` contents;
* API keys;
* tokens;
* sensitive employee or client data.

The permanent `AGENTS.md` must not be repeatedly rewritten for each release incident.
