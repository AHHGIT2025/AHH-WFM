# Release Notes v0.9.0 — SAP SuccessFactors Integration Hub Foundation

This release implements the SAP SuccessFactors Integration Hub Foundation (Phase 5A) for the AHH WFM system, establishing the database schemas, api controllers, mock ingestion sync loop, fault-tolerance queues, and web admin monitoring consoles.

## Key Features

### 1. Unified Integration Database Infrastructure
- Added **`SapConnection`** to store endpoint target metadata safely (using vault/placeholder identifiers).
- Added **`SapSyncJob`** and **`SapSyncLog`** to track run-time logs, statuses, and performance profiles.
- Added **`SapFieldMapping`** to hold dynamic OData JSON translation rules and transformations.
- Added **`SapRetryQueue`** to intercept anomalies and manage retry cycles.

### 2. Mock Inbound Sync Engine
- Built a simulation-ready ingestion processor for Employee master records and Organizational hierarchies (departments, cost centers, locations).
- Implemented **Local Employee Deactivations**: Automatically marks employees as inactive (`isActive = false`) and status `Offline` when SuccessFactors marks them `TERMINATED`.
- **Fault-Tolerance Isolation:** Non-blocking validation checks automatically route records with schema discrepancies (such as missing emails) to the retry queue while processing remaining records.

### 3. Integrated Web Command Center UI
Consolidated all administration controls under `/sap`:
- **Connection status cards** with masked key displays.
- **Sync triggers** supporting module filtering and type switches.
- **Job history monitors** with details modal panels.
- **Dynamic mapping managers** supporting transformation rule editing.
- **Active retry panels** to manually force queue processing.

## API Additions
- `GET/POST /api/v1/sap/connections` — Lists/registers endpoint configurations.
- `GET/POST /api/v1/sap/sync` — Fetches sync status or triggers manual sync.
- `GET /api/v1/sap/jobs` — Audits synchronization jobs.
- `GET /api/v1/sap/logs` — Retrieves detailed diagnostic job runs.
- `GET/POST/PUT /api/v1/sap/mappings` — Manages translation maps.
- `POST /api/v1/sap/retry` — Re-runs failed items.

## Verification Results
- All tests passed: Organizational departments and locations were provisioned, employees were successfully registered/updated, terminations deactivated local user accounts, and failed logs were successfully caught in the DLQ and resolved.
