# SECFAC Phase 6A.2 — Implementation & Architecture Architecture

## Overview
SECFAC Phase 6A.2 extends the Phase 6A.1 SOS and dispatch foundation with full responder mobile dispatch workflows, lone-worker welfare check generation and monitoring, patrol assurance evaluation (15m late, 30m missed), sequence adherence, binary SHA-256 evidence verification, and established Phase 5C worker runtime integration.

## Applied Corrections
1. **Existing OperationType Enum:** Model relations and services use `OperationType` (`SECURITY_GUARDING` | `FACILITY_MANAGEMENT`) strictly without string fallbacks or default values.
2. **Evidence Default Status:** `SecfacEvidenceAttachment.integrityStatus` defaults to `UNVERIFIED`. State transitions to `VERIFIED` or `MISMATCH` only via server-side binary SHA-256 computation.
3. **Controlled Welfare Setting Source:** `SecFacWelfareSettingSourceType` enum (`POST` | `SITE` | `PROJECT` | `COMPANY` | `SYSTEM_DEFAULT`) tracks setting precedence origin.
4. **Normalized ScopeKey Uniqueness:** `scopeKey` (e.g. `SECURITY_GUARDING:COMPANY:COMP-002`) prevents duplicate active welfare configurations in transactional creation.
5. **User vs Employee Relations:** Administrative actions and creator fields reference `Employee` (`session.user.id` maps directly to `Employee.id` in NextAuth).
6. **Phase 5C Worker Runtime:** Integrated 4 independent jobs (`SECFAC_DISPATCH_TIMEOUT`, `SECFAC_WELFARE_GENERATE`, `SECFAC_WELFARE_MISSED_EVALUATE`, `SECFAC_PATROL_ASSURANCE_EVALUATE`) with separate distributed locks (`SecFacWorkerLock`).

## Reused Components
* Phase 5B Operational Alerts & Deduplication Engine
* Phase 5C Worker Locks & Health Monitoring
* Phase 6A.1 Emergency SOS & Dispatch Assignment Model
* Field Execution Audit Helper (`createSecfacFieldExecutionAudit`)
