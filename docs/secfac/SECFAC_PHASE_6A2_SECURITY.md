# SECFAC Phase 6A.2 — Security & Scope Isolation Architecture

## Role Boundaries & Least Privilege
* **Guards & Technicians:** Can view & respond to own dispatches, acknowledge own welfare checks, view own patrol executions, upload own evidence. Cannot manage settings, reassign dispatches, verify evidence globally, or execute worker routes.
* **Supervisors:** Can view assigned site operations, manage site/post welfare exemptions, acknowledge patrol exceptions, review site evidence.
* **Control Room & Operations:** Can monitor dispatches, reassign responders, view timeout events, monitor welfare checks and patrol exceptions, resolve operational alerts.
* **Admin & Super Admin:** Cross-scope access with full audit logging.

## Scope Isolation
* Security Guarding and Facility Management isolation enforced at service and API levels.
* Cross-company, cross-project, and cross-site access denied unless explicitly authorized.

## Evidence Hash Verification Security
* Evidence default status: `UNVERIFIED`.
* SHA-256 hash calculated from binary bytes server-side (`serverFileHash`).
* Hash mismatch triggers `EVIDENCE_HASH_MISMATCH` security audit event with client and server hash details.
