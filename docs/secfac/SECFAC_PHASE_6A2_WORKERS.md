# SECFAC Phase 6A.2 — Worker Architecture & Execution Specs

## Independent Jobs
1. `SECFAC_DISPATCH_TIMEOUT`: Lock `lock:secfac:dispatch-timeout`. Evaluates pending dispatches past acceptance deadline (2 mins) and transitions status to `TIMED_OUT`.
2. `SECFAC_WELFARE_GENERATE`: Lock `lock:secfac:welfare-generate`. Generates next welfare check-in targets for active lone-worker deployments based on effective setting precedence.
3. `SECFAC_WELFARE_MISSED_EVALUATE`: Lock `lock:secfac:welfare-missed-eval`. Evaluates expired welfare checks, marks status `MISSED`, and creates `WELFARE_CHECK_MISSED` operational alert and in-app notification.
4. `SECFAC_PATROL_ASSURANCE_EVALUATE`: Lock `lock:secfac:patrol-assurance-eval`. Calculates execution-specific target times, evaluates 15m late and 30m missed thresholds, checks sequence adherence, and creates deduplicated alerts.

## Failure Isolation & Distributed Locks
* Each job operates under `SecFacWorkerLock` with an independent lock key and error boundary.
* A failure in one job does not disrupt remaining jobs.
* Manual execution route `POST /api/v1/secfac/workers/run-phase6a2` is restricted by internal worker tokens (`WORKER_INTERNAL_SECRET`) or `secfac.worker.monitor` permission.
