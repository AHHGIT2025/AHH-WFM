# SECFAC Phase 6A.2 — API Specification

## Dispatch APIs
* `GET /api/v1/secfac/dispatch/my-active` — Mobile responder active dispatch assignment.
* `POST /api/v1/secfac/dispatch/[id]/accept` — Accept dispatch.
* `POST /api/v1/secfac/dispatch/[id]/reject` — Reject dispatch with category & reason.
* `POST /api/v1/secfac/dispatch/[id]/arrive` — Mark arrival at scene with GPS coordinates.
* `POST /api/v1/secfac/dispatch/[id]/complete` — Complete dispatch assignment (does NOT close parent alert).
* `POST /api/v1/secfac/dispatch/[id]/reassign` — Reassign dispatch to another responder with attempt history.

## Welfare Check APIs
* `GET /api/v1/secfac/welfare/my-active` — Mobile active lone worker check-in target.
* `POST /api/v1/secfac/welfare/[id]/acknowledge` — Guard "I'm Safe" check-in.
* `POST /api/v1/secfac/welfare/[id]/exempt` — Supervisor override or shift-end cancellation.
* `GET /api/v1/secfac/welfare/checks` — List welfare checks.
* `GET / POST /api/v1/secfac/welfare/settings` — Welfare setting precedence configuration.

## Patrol Assurance APIs
* `POST /api/v1/secfac/patrol-assurance/acknowledge-exception` — Supervisor exception acknowledgement.

## Evidence API
* `POST /api/v1/secfac/evidence` — Multipart evidence upload with `clientFileHash`, `idempotencyKey`, and server binary SHA-256 verification.

## Worker Execution API
* `POST /api/v1/secfac/workers/run-phase6a2` — Manual worker evaluation trigger (requires `x-worker-internal-token` or `secfac.worker.monitor` permission).
