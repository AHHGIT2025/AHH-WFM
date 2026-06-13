# Release Notes v0.12.0 — SAP SuccessFactors Overtime, Payroll & Roster Outbound Sync

This release implements Phase 5B.2, finishing the SAP SuccessFactors operational synchronization layer by introducing Payroll Staging computation pools, wage type mappings, period locking controls, dynamic roster exports, and overtime reconciliation auditing.

## Key Features

### 1. Payroll Staging Engine & Locking Controls
- Added the **`SapPayrollStage`** model to stage calculated overtime pay in QAR per employee/period.
- Implemented the **`SapPayrollPeriodLock`** table to freeze payroll data. Once a period (e.g., `2026-06`) is locked, it prevents modifications or restaging.
- Locks act as an audit boundary: periods must be locked prior to exporting compensation data.

### 2. Wage Type Translations
- Overtime segments are automatically translated into specific SAP wage codes based on configurable rates:
  - Weekday OT $\rightarrow$ `WT_OT_STD`
  - Weekend OT $\rightarrow$ `WT_OT_WKD`
  - Holiday OT $\rightarrow$ `WT_OT_HOL`
  - Night Shift OT $\rightarrow$ `WT_OT_NGT`

### 3. Outbound Comp & Roster Exports
- Generates **`EmpCompensation`** OData payloads mapping payroll periods, wage types, calculated hours, and estimated payouts.
- Synchronizes employee schedule rosters (**`ShiftAssignment`**) outbound with uniqueness check keys (`ROSTER_EXPORT_[ID]`).

### 4. Overtime Reconciliation Gaps
- Extends the reconciliation auditor to detect and record discrepancies between local WFM overtime hours and SAP compensation statements, logging detailed delta metrics.

### 5. Web Console UI Upgrades
- Created a **Payroll Staging** dashboard console tab under `/sap` on the web app to manage freeze periods, review staging rows, track approvals, and trigger compensation payload exports.

## API Additions
- `GET/POST/PUT /api/v1/sap/payroll` — Staging calculations, locking toggles, line item approvals, and compensation exports.
- `POST /api/v1/sap/export` — Extended to handle outbound `OVERTIME` and `ROSTER` batch exports.

## Verification
- Monorepo compiles cleanly with zero compilation errors (`npm run build` succeeds).
- Lock constraints successfully block edits, and wage codes are mapped accurately.
