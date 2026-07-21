# AGENTS.md — AHH WFM Agent Operating Manual

## 1. Project Identity

Project: AHH WFM
Organization: Al Hattab Holding
Repository: AHHGIT2025/AHH-WFM
Primary branch: manpower-operations-scope

LOCAL development workspace:

D:\AI Projects\AHH WFM\app

SERVER deployment workspace:

D:\Apps\AHH-WFM\dev

Technology stack:

- Next.js monorepo
- apps/web
- apps/mobile
- packages/database using Prisma and MySQL
- packages/mock-data
- packages/types
- packages/ui
- PM2-managed server applications

---

## 2. Mandatory LOCAL and SERVER Separation

All agents must clearly label every command as one of:

- RUN ON LOCAL
- RUN ON SERVER
- RUN ON BOTH

### LOCAL responsibilities

Use LOCAL for:

- Repository analysis
- Code implementation
- Prisma schema changes
- Migration creation
- Unit and integration tests
- Browser and UI testing
- Builds before commit
- Git commit
- Git push
- Documentation updates

### SERVER responsibilities

Use SERVER only for:

- Fetching an already verified commit
- Resetting to origin/manpower-operations-scope
- Installing dependencies
- Prisma migration deployment
- Production-style builds
- PM2 restart
- Runtime and HTTP verification
- Server log inspection

Never implement code directly inside:

D:\Apps\AHH-WFM\dev

Never create migrations directly on the server.

---

## 3. Core Business Rules

These rules are mandatory and must not be changed without explicit approval.

1. Workforce Directory is the employee master.
2. White Collar current duty comes from Employee Default Location.
3. Blue Collar current duty comes from Shift Planner or Deployment Worksite.
4. Security Guarding and Facility Management are separate operational scopes.
5. Users from Security Guarding must not access Facility Management data.
6. Users from Facility Management must not access Security Guarding data.
7. Cross-scope access is permitted only for explicitly authorized ADMIN or SUPER_ADMIN users.
8. Workflow setup is centralized under Settings.
9. Addendum is allowed only for ACTIVE contracts.
10. DRAFT contracts may be viewed, edited, deleted, or submitted.
11. APPROVED contracts may only be viewed or activated.
12. ACTIVE contracts may only be viewed, amended, or terminated.
13. REJECTED contracts may be viewed, edited, and resubmitted.
14. Existing modules must not be disturbed by new features.
15. Any conflict with existing business rules must be reported before implementation.

---

## 4. SECFAC Governance Rules

Current controlled operational phase:

Phase 5D live monitoring pilot.

Mandatory restrictions:

- Pilot start date: July 21, 2026.
- Earliest valid completion date: July 28, 2026.
- Phase 5E is not approved.
- Do not implement Phase 5E functionality.
- Do not fabricate historical pilot data.
- Do not backfill monitoring records.
- Do not simulate previous operational days.
- Do not delete genuine live pilot data.
- Do not alter genuine monitoring timestamps.
- External channels such as EMAIL, PUSH, WHATSAPP, and SMS remain disabled unless explicitly approved.
- Monitoring evidence must come from genuine live execution.

Agents must stop and report any request that conflicts with these controls.

---

## 5. Required Agent Workflow

Before modifying code:

1. Read this AGENTS.md.
2. Run git status.
3. Confirm the active branch.
4. Inspect relevant architecture and roadmap documents.
5. Identify files likely to be modified.
6. Identify possible conflicts with existing modules.
7. Produce a short implementation plan.
8. Wait for approval when the change is high risk.

During implementation:

1. Make the smallest safe change.
2. Do not refactor unrelated code.
3. Preserve backward compatibility.
4. Preserve Security Guarding and Facility Management isolation.
5. Reuse existing helpers, authorization checks, types, and patterns.
6. Do not expose secrets or environment values.
7. Do not weaken validation to make tests pass.
8. Do not silently ignore runtime errors.

After implementation:

1. Review git diff.
2. Run required verification.
3. Report files changed.
4. Report tests executed.
5. Report failures or skipped tests honestly.
6. Confirm whether a migration was created.
7. Confirm whether database data was changed.
8. Confirm whether a commit was created.
9. Confirm whether a push was performed.
10. Provide the full SERVER deployment sequence when the change is verified and pushed.

---

## 6. Git Safety Rules

Before work:

```powershell
git status
git branch --show-current
git log -5 --oneline
