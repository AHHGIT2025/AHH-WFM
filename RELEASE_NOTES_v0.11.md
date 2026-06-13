# Release Notes v0.11.0 — SAP SuccessFactors Leave & Attendance Outbound Sync

This release implements the SAP SuccessFactors operational synchronization layer for Leave and Attendance transactions (Phase 5B.1), enabling outbound exports, idempotency protections, and reconciliation audits.

## Key Features

### 1. Outbound Synchronization Queue
- Introduced **`SapExportQueue`** to stage and process approved leave requests and completed check-out/check-out logs.
- Generated mock **OData Payloads** for SAP SuccessFactors integration:
  - **`EmployeeTime`**: Schema matching SuccessFactors leave tracking.
  - **`TimeSheetEntry`**: Schema matching SuccessFactors timesheet tracking.

### 2. Idempotency & Duplicate Prevention
- Enforces uniqueness on export payloads using deterministic keys:
  - Leave Requests: `LEAVE_EXPORT_[ID]`
  - Attendance Records: `ATT_EXPORT_[ID]`
- Prevents redundant transfers by checking existing keys in the export database before sending.

### 3. Acknowledgement & Status Tracking
- Tracks synchronization responses with SuccessFactors:
  - Captures `sapAckId`, `sapAckStatus` (e.g., `ACKNOWLEDGED`), and RFC 3339 `sapAckTimestamp` on callbacks.
  - Keeps failed exports in the queue under `FAILED` state for manual retry.

### 4. Reconciliation Audit Engine
- Added **`SapReconciliationLog`** database tracking.
- Compares local WFM database hours with SuccessFactors-reported timesheet hours, generating discrepancy reports for deviations.

## API Additions
- `GET/POST /api/v1/sap/export` — Retrieve export queue records or run manual batch module exports.
- `POST /api/v1/sap/export/retry` — Re-attempts processing failed or pending items in the export queue.
- `GET/POST /api/v1/sap/reconciliation` — Audits local vs. SAP timesheet logs.

## Verification
- Verified outbound OData structures.
- Confirmed duplicate requests are ignored and that failed runs register in the retry queues.
