# SECFAC Phase 6A.2 — Business Rules

## 1. Alert Closure Separation
* Dispatch completion transitions `SecFacDispatchAssignment` status to `COMPLETED` and attaches completion notes & evidence.
* Dispatch completion **does NOT** automatically close or resolve the underlying `SecFacOperationalAlert`. Operational alert resolution remains a separate dispatcher or supervisor action.

## 2. Welfare Check Precedence & Scheduling
* Setting Precedence: `Post` → `Site` → `Project` → `Company` → `System Default` (60m frequency, 10m grace period).
* Bounded Generation: Generates check-in targets for active lone-worker deployments only during active shift hours. Shift completion automatically cancels future pending checks while preserving missed audit history.
* Guard Acknowledgement: Offline check-ins display `CHECK-IN SAVED — NOT YET CONFIRMED` until server receipt. Late offline check-ins preserve `MISSED` audit history while recording late confirmation timestamp.

## 3. Patrol Assurance & Target Time Evaluation
* Target Time: Execution-specific calculation based on `startedAt + sequenceNo * offsetMins`.
* Late Threshold: 15 minutes past target time (`PATROL_CHECKPOINT_LATE` alert).
* Missed Threshold: 30 minutes past target time (`PATROL_CHECKPOINT_MISSED` alert).
* Sequence Modes:
  - `MANDATORY`: Strict order required; out-of-order scans set `SEQUENCE_DEVIATION`.
  - `ADVISORY`: Out-of-order scans record warning flag but validate scan.
  - `ANY_ORDER`: Checkpoints can be scanned in any order without penalty.

## 4. Evidence Integrity Rules
* Binary SHA-256 hash calculated server-side directly from received bytes.
* Client-provided `clientFileHash` compared with `serverFileHash`. Match = `VERIFIED`, mismatch = `MISMATCH` + Security Audit event. Default = `UNVERIFIED`.
