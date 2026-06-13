# Workforce Feature Roadmap: AHH WFM

This document outlines the evolutionary development roadmap for the **AHH WFM** (Workforce Management) application suite, detailing sequential feature implementation phases, database impacts, endpoint models, and screen coordinates.

---

## Phase 1: Core Directory & Status Systems (Foundation)

### 1.1 Employee CRUD
*   **Business Purpose**: Manage the primary roster of employees, enabling HR to register new field operatives, update details, or offboard staff.
*   **Database Impact**: Requires full insert/select/update/delete operations on the `Employee` model.
*   **API Endpoints Required**:
    *   `GET /api/v1/employees` (List all employees with pagination)
    *   `GET /api/v1/employees/:id` (Retrieve single employee profile)
    *   `POST /api/v1/employees` (Register new employee)
    *   `PUT /api/v1/employees/:id` (Update employee details)
    *   `DELETE /api/v1/employees/:id` (Soft-delete or disable employee account)
*   **UI Screens Affected**:
    *   Web: Workforce Directory (`/workforce`) - Add/Edit Employee Modal, Details Panel.
*   **Estimated Implementation Effort**: 3 Days

### 1.2 Employee Status Management
*   **Business Purpose**: Monitor active working states of employees (e.g., *On Duty*, *On Break*, *Offline*, *On Leave*) in real time to optimize dispatching and tracking.
*   **Database Impact**: Update `status` field on the `Employee` model. Logs status transitions to a history ledger `StatusLog` (New Table) for audit.
*   **API Endpoints Required**:
    *   `PUT /api/v1/employees/:id/status` (Modify active working status)
    *   `GET /api/v1/employees/:id/status-history` (Get historical transitions)
*   **UI Screens Affected**:
    *   Web: Dashboard Overview (`/`) - Active operatives status lists.
    *   Mobile: Home Dashboard (`/`) - Active status indicator and shift timers.
*   **Estimated Implementation Effort**: 2 Days

### 1.3 Department Management
*   **Business Purpose**: Segment workforce into operational units (e.g., *Engineering*, *Operations*, *Logistics*) for structured permissions, reporting, and shift rules.
*   **Database Impact**: Introduce a `Department` model (New Table) linked to `Employee` via `departmentId` relationship.
*   **API Endpoints Required**:
    *   `GET /api/v1/departments` (List departments)
    *   `POST /api/v1/departments` (Create department)
    *   `PUT /api/v1/departments/:id` (Update department rules/details)
    *   `DELETE /api/v1/departments/:id` (Decommission department)
*   **UI Screens Affected**:
    *   Web: Settings & Configurations (`/settings`) - Department list, supervisor assignments, and operational tags.
*   **Estimated Implementation Effort**: 2 Days

---

## Phase 2: Attendance Control & Verification (Completed)

### 2.1 Attendance Validation (Completed)
*   **Business Purpose**: Prevent payroll leaks by validating check-in requests against device fingerprints, network addresses, and time schedule tolerances.
*   **Database Impact**: Add validation flags (`isValid`, `failureReason`, `validatedBy`) to the `AttendanceRecord` model.
*   **API Endpoints Required**:
    *   `POST /api/v1/attendance/check-in` (Processes validations as middleware checks)
    *   `GET /api/v1/attendance/flagged` (List records that failed validations)
*   **UI Screens Affected**:
    *   Web: Attendance Monitor (`/attendance`) - Exception flags, audit indicators.
*   **Estimated Implementation Effort**: 3 Days

### 2.2 Geofencing Rules (Completed)
*   **Business Purpose**: Restrict worker clock-in actions to authorized physical client sites or regional HQ perimeters using GPS validation.
*   **Database Impact**: Create a `GeofenceZone` model (New Table) holding coordinate radii, latitude, longitude, and map vertices. Link zones to departments or specific shifts.
*   **API Endpoints Required**:
    *   `GET /api/v1/geofences` (List geofence areas)
    *   `POST /api/v1/geofences` (Add new geofence zone)
    *   `PUT /api/v1/geofences/:id` (Modify geofence perimeter coordinates)
*   **UI Screens Affected**:
    *   Web: Settings / Site Mapping (`/settings`) - Map interface with polygon drawer.
    *   Mobile: Check-In View (`/`) - Real-time zone resolution status.
*   **Estimated Implementation Effort**: 4 Days

### 2.3 Attendance Corrections (Completed)
*   **Business Purpose**: Enable employees to request clock-in modifications for missed shifts or system downtime, subject to manager approval.
*   **Database Impact**: Create an `AttendanceCorrection` model (New Table) tracking requested shifts, requested timestamps, reasons, and approval states.
*   **API Endpoints Required**:
    *   `POST /api/v1/attendance/corrections` (Request correction)
    *   `GET /api/v1/attendance/corrections/pending` (List pending approval)
    *   `PUT /api/v1/attendance/corrections/:id` (Approve/Reject correction request)
*   **UI Screens Affected**:
    *   Web: Attendance Monitor (`/attendance`) - Correction requests inbox.
    *   Mobile: Attendance History Logs (`/history`) - "Request Correction" triggers.
*   **Estimated Implementation Effort**: 3 Days

### 2.4 Late Arrival Tracking (Completed)
*   **Business Purpose**: Automatically detect and report when an employee check-in occurs after the scheduled shift start, providing metrics for operational compliance.
*   **Database Impact**: Auto-flag `status` as `"Late"` on the `AttendanceRecord` record based on comparing the scheduled shift start time and actual check-in.
*   **API Endpoints Required**:
    *   `GET /api/v1/reports/attendance/lateness` (List lateness metrics and frequencies)
*   **UI Screens Affected**:
    *   Web: Overview Dashboard (`/`) - Late arrivals counters.
    *   Mobile: Home Dashboard (`/`) - Visual warning when clocked in late.
*   **Estimated Implementation Effort**: 2 Days

---

## Phase 3: Leave Management & Calendar Integration (Phase 3A Completed)

### 3.1 Leave Balances (Completed)
*   **Business Purpose**: Maintain precise tracking of available annual, sick, and unpaid leave allowances for each employee.
*   **Database Impact**: Create a `LeaveBalance` model (New Table) mapping `employeeId` to categories and count balances.
*   **API Endpoints Required**:
    *   `GET /api/v1/employees/:id/leave-balances` (Retrieve balance counts)
*   **UI Screens Affected**:
    *   Web: Workforce Directory Profile Detail.
    *   Mobile: Leave Request Dashboard (`/leave`) - Remaining balance meters.
*   **Estimated Implementation Effort**: 2 Days

### 3.2 Leave Accruals (Completed)
*   **Business Purpose**: Automatically increment employee leave balances monthly or annually based on service tenure and contract regulations.
*   **Database Impact**: Cron job trigger updating the `LeaveBalance` records. Audit trail saved in `AccrualLog` (New Table).
*   **API Endpoints Required**:
    *   `POST /api/v1/leaves/accruals/run` (Manual trigger for testing)
*   **UI Screens Affected**:
    *   Web: Admin Settings (`/settings`) - Accrual rule settings and schedules.
*   **Estimated Implementation Effort**: 3 Days

### 3.3 Multi-Level Approvals (Completed)
*   **Business Purpose**: Enforce a hierarchical workflow where leave requests must be approved by the Department Head first, followed by HR.
*   **Database Impact**: Track approval workflows in `LeaveRequest` using states (e.g., `PENDING_SUPERVISOR`, `PENDING_HR`, `APPROVED`, `REJECTED`).
*   **API Endpoints Required**:
    *   `POST /api/v1/leaves/approve` (Approve step)
    *   `POST /api/v1/leaves/reject` (Reject step)
    *   `GET /api/v1/leaves/history` (Timeline history)
*   **UI Screens Affected**:
    *   Web: Leave & Approvals console (`/leave`) - Segmented review queues (Direct, Delegated, Escalated).
*   **Estimated Implementation Effort**: 4 Days

### 3.4 Holiday Calendar Integration (Completed)
*   **Business Purpose**: Import public holidays to automatically skip check-in expectations and adjust leave charge calculations.
*   **Database Impact**: Create a `PublicHoliday` model (New Table) storing calendar dates, country rules, and work exclusions.
*   **API Endpoints Required**:
    *   `GET /api/v1/calendar/holidays` (List holidays)
    *   `POST /api/v1/calendar/holidays` (Add new holiday event)
*   **UI Screens Affected**:
    *   Web: Settings / System Calendar.
    *   Mobile: News Board / Notifications Feed.
*   **Estimated Implementation Effort**: 3 Days

---

## Phase 4: Scheduling & Resource Optimization (Phase 4A Completed)

### 4.1 Shift Templates & Assignments (Completed - Phase 4A)
*   **Business Purpose**: Configure shift blocks (Morning, Evening, Night, Split, Flexible) and assign employees to dates, running real-time conflict checking.
*   **Database Impact**: Create `ShiftTemplate` and `ShiftAssignment` models.
*   **API Endpoints Required**:
    *   `GET/POST /api/v1/shifts/templates` (View/create templates)
    *   `GET/POST /api/v1/shifts/assignments` (Roster viewing/individual scheduling)
    *   `POST /api/v1/shifts/assignments/bulk` (Bulk scheduler)
*   **UI Screens Affected**:
    *   Web: Shift Planner Board (`/shifts`) - Grid timeline showing active rosters, bulk scheduling actions, conflict warning tooltips.
    *   Mobile: Shifts Log (`/shifts`) - Roster views for employees.
*   **Estimated Implementation Effort**: Completed

### 4.2 Rotation Templates & Assignments (Completed - Phase 4A)
*   **Business Purpose**: Deploy cyclical patterns (e.g. 5x2, 6x1, 4 On/4 Off) across employees while warning of approved leaves, inactive employees, or overlaps.
*   **Database Impact**: Create `RotationTemplate` model.
*   **API Endpoints Required**:
    *   `GET/POST /api/v1/shifts/rotations` (View/create rotation templates)
    *   `POST /api/v1/shifts/assignments/rotations` (Apply rotation and get conflict logs)
*   **UI Screens Affected**:
    *   Web: Shift Management (`/shifts`) - Rotation applicator form.
*   **Estimated Implementation Effort**: Completed

### 4.3 Overtime Calculations (Completed - Phase 4B)
*   **Business Purpose**: Calculate work hours exceeding standard shifts (Weekend, Holiday, standard Overtime, Night, Special Event) for payroll.
*   **Database Impact**: Extended `AttendanceRecord` with standard, weekend, holiday, night, special event overtime columns, approved OT, amount, status, and created the `OvertimeRate` config table.
*   **API Endpoints Required**:
    *   `GET/PUT /api/v1/shifts/overtime` (Overtime approvals management)
    *   `GET/POST /api/v1/overtime-rates` and `PATCH /api/v1/overtime-rates/[id]` (Overtime rates setup)
*   **UI Screens Affected**:
    *   Web: Shifts Board (`/shifts`) - Overtime manager approvals and Rates setting tables.
    *   Mobile: Shifts Calendar Portal (`/shifts`) - My Overtime status claim logger.
*   **Estimated Implementation Effort**: Completed

### 4.4 Workforce Coverage & Heatmaps (Completed - Phase 4B)
*   **Business Purpose**: Coverage gap analysis comparing scheduled headcounts vs actual operative clock-ins.
*   **Database Impact**: Analytical coverage aggregation comparing shift assignments headcount rules.
*   **API Endpoints Required**:
    *   `GET /api/v1/shifts/coverage`
*   **UI Screens Affected**:
    *   Web: Shifts Board planner (`/shifts`) - Togglable heat-map overlay layer.
*   **Estimated Implementation Effort**: Completed



---

## Phase 5: SAP SuccessFactors Integration Hub

### 5.1 Employee Sync (Completed - Phase 5A)
*   **Business Purpose**: Replicate employee records, contract types, and status data automatically from SuccessFactors to local MySQL database.
*   **Database Impact**: Writes update logs, inserts new users, and disables separated employees. Added connections, jobs, logs, mappings, and retry queue models.
*   **API Endpoints Required**:
    *   `GET/POST /api/v1/sap/connections`
    *   `GET/POST /api/v1/sap/sync`
    *   `GET /api/v1/sap/jobs`
    *   `GET /api/v1/sap/logs`
    *   `GET/POST/PUT /api/v1/sap/mappings`
    *   `POST /api/v1/sap/retry`
*   **UI Screens Affected**:
    *   Web: SAP SuccessFactors Hub (`/sap`) - Sync indicators, configurations, retry logs, and mapping rules.
*   **Estimated Implementation Effort**: Completed

### 5.2 Leave Sync (Completed - Phase 5B.1)
*   **Business Purpose**: Synchronize approved leaves and time-off request entries between the WFM application and SAP.
*   **Database Impact**: Writes to `SapExportQueue` using idempotency key `LEAVE_EXPORT_[ID]`, records SAP Ack ID.
*   **API Endpoints Required**:
    *   `GET/POST /api/v1/sap/export` (For queue fetching and triggering outbound sync)
    *   `POST /api/v1/sap/export/retry` (For queue items retry)
*   **UI Screens Affected**:
    *   Web: SAP SuccessFactors Hub (`/sap`) - Outbound export logs panel.
*   **Estimated Implementation Effort**: Completed

### 5.3 Attendance Sync (Completed - Phase 5B.1)
*   **Business Purpose**: Replicate local verified check-in data into SAP timesheets for salary processing.
*   **Database Impact**: Writes to `SapExportQueue` using idempotency key `ATT_EXPORT_[ID]`, records SAP Ack ID, updates reconciliation logs in `SapReconciliationLog`.
*   **API Endpoints Required**:
    *   `GET/POST /api/v1/sap/export` (For queue fetching and triggering outbound sync)
    *   `GET/POST /api/v1/sap/reconciliation` (For run comparing local vs SAP hours)
*   **UI Screens Affected**:
    *   Web: SAP SuccessFactors Hub (`/sap`) - Reconciliation Board and Timesheet logs.
*   **Estimated Implementation Effort**: Completed

### 5.4 Overtime & Compensation Sync (Completed - Phase 5B.2)
*   **Business Purpose**: Sync approved overtime calculations, staged rates, and compensation adjustments.
*   **Database Impact**: Staged rows logged to `SapPayrollStage` and locked periods tracked in `SapPayrollPeriodLock`.
*   **API Endpoints Required**:
    *   `GET/POST/PUT /api/v1/sap/payroll` (Calculates, locks, approves, and exports)
*   **UI Screens Affected**:
    *   Web: SAP SuccessFactors Hub (`/sap`) - Payroll Staging Console.
*   **Estimated Implementation Effort**: Completed

### 5.5 Shift & Roster Sync (Completed - Phase 5B.2)
*   **Business Purpose**: Synchronize schedule roster mappings outbound.
*   **Database Impact**: Staged in `SapExportQueue` using idempotency key `ROSTER_EXPORT_[ID]`.
*   **API Endpoints Required**:
    *   `POST /api/v1/sap/export` (Triggers batch roster export)
*   **UI Screens Affected**:
    *   Web: SAP SuccessFactors Hub (`/sap`) - Outbound export queue.
*   **Estimated Implementation Effort**: Completed



