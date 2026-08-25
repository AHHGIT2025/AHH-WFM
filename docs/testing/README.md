# AHH WFM — UAT Testing Index

## Security Guarding Commercial Lifecycle UAT

| Script | File | Purpose |
|---|---|---|
| **Tester 1 — Primary End-to-End** | [CL-UAT-TESTER-1-SECURITY-GUARDING.md](CL-UAT-TESTER-1-SECURITY-GUARDING.md) | Happy path: CL-1 Activities → CL-2 CRM → CL-3 Survey → CL-4 Costing → CL-5 Proposal/Acceptance/Conversion → CL-6 Handover → CL-7 Addendum ADD → CL-8 Renewal (NEW_TERM) |
| **Tester 2 — Alternate / Exception Path** | [CL-UAT-TESTER-2-SECURITY-GUARDING.md](CL-UAT-TESTER-2-SECURITY-GUARDING.md) | Exception paths: Survey RETURN/resubmit, Client CHANGE_REQUESTED, Proposal B ACCEPTED, Addendum MODIFY + RETURN + REMOVE, Renewal DECLINED, extended negatives |

## Prerequisites (CIO / System Admin Actions Required Before UAT)

1. Application running at `http://localhost:3100` (LOCAL)
2. Login credentials provided to both testers
3. Workflow approvers configured in `Settings > Workflow Setup` for:
   - SITE_SURVEY workflow
   - COSTING workflow
   - PROPOSAL workflow
   - COMMERCIAL_ADDENDUM workflow (CL7 Central Addendum Workflow — add approval levels)
   - CONTRACT_RENEWAL workflow
4. Both testers can run simultaneously — all records are isolated by UAT prefix

## UAT Operation Scope

| Scope | Status |
|---|---|
| SECURITY_GUARDING | ✅ IN SCOPE |
| FACILITY_MANAGEMENT | ❌ OUT OF SCOPE |
| SECFAC | ❌ PAUSED BY CIO |
| Outlook Live Graph | ❌ NOT APPLICABLE — Pending Entra Approval |

## Commit Candidate

`458cff1149fd55ba7d06c51ecaf8f36ba2aba4a3`

Branch: `manpower-operations-scope`
