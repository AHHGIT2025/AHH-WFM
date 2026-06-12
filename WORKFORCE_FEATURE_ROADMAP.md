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

### 3.3 Multi-Level Approvals
*   **Business Purpose**: Enforce a hierarchical workflow where leave requests must be approved by the Department Head first, followed by HR.
*   **Database Impact**: Track approval workflows in `LeaveRequest` using states (e.g., `PENDING_SUPERVISOR`, `PENDING_HR`, `APPROVED`, `REJECTED`).
*   **API Endpoints Required**:
    *   `GET /api/v1/leaves/approvals/pending` (List approvals needed for the caller)
    *   `PUT /api/v1/leaves/approvals/:id` (Approve/Reject step)
*   **UI Screens Affected**:
    *   Web: Leave & Approvals console (`/leave`) - Segmented review queues.
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

## Phase 4: Scheduling & Resource Optimization

### 4.1 Shift Scheduling
*   **Business Purpose**: Assign employees to shift blocks, creating structured weekly work allocations.
*   **Database Impact**: Create a `ScheduleAssignment` model (New Table) linking `employeeId`, `shiftId`, and `date`.
*   **API Endpoints Required**:
    *   `GET /api/v1/schedules` (Get active roster calendar schedule)
    *   `POST /api/v1/schedules/assign` (Bulk assign employees to shifts)
*   **UI Screens Affected**:
    *   Web: Shift Management (`/shifts`) - Interactive schedule calendar view.
*   **Estimated Implementation Effort**: 5 Days

### 4.2 Rotation Templates
*   **Business Purpose**: Automate cyclical shift patterns (e.g., *2 Weeks Day Shift followed by 2 Weeks Night Shift*) for large employee pools.
*   **Database Impact**: Create a `RotationTemplate` model (New Table) containing shift sequence order rules.
*   **API Endpoints Required**:
    *   `GET /api/v1/shifts/rotations` (Get template configurations)
    *   `POST /api/v1/shifts/rotations/apply` (Execute rotation script)
*   **UI Screens Affected**:
    *   Web: Shift Management (`/shifts`) - Rotation configurations panel.
*   **Estimated Implementation Effort**: 4 Days

### 4.3 Overtime Calculations
*   **Business Purpose**: Automatically calculate work hours exceeding standard shifts for automated timesheet preparation.
*   **Database Impact**: Store `overtimeMinutes` and `overtimeStatus` in the `AttendanceRecord` model.
*   **API Endpoints Required**:
    *   `GET /api/v1/reports/overtime` (Retrieve overtime log audits)
*   **UI Screens Affected**:
    *   Web: Attendance Monitor and Payroll Reports.
*   **Estimated Implementation Effort**: 3 Days

### 4.4 Workforce Coverage Analysis
*   **Business Purpose**: Visualize staff coverage percentages across departments against predefined project targets to ensure operational readiness.
*   **Database Impact**: Analytical queries comparing scheduled allocations against actual active clock-ins.
*   **API Endpoints Required**:
    *   `GET /api/v1/analytics/coverage` (Retrieve coverage metrics)
*   **UI Screens Affected**:
    *   Web: Overview Dashboard (`/`) - Live coverage widgets and charts.
*   **Estimated Implementation Effort**: 3 Days

---

## Phase 5: SAP SuccessFactors Integration Hub

### 5.1 Employee Sync
*   **Business Purpose**: Replicate employee records, contract types, and status data automatically from SuccessFactors to local MySQL database.
*   **Database Impact**: Writes update logs, inserts new users, and disables separated employees.
*   **API Endpoints Required**:
    *   `POST /api/v1/sap/sync/employees` (Triggers employee sync)
*   **UI Screens Affected**:
    *   Web: SAP SuccessFactors Hub (`/sap`) - Sync indicators.
*   **Estimated Implementation Effort**: 4 Days

### 5.2 Leave Sync
*   **Business Purpose**: Synchronize approved leaves and time-off request entries between the WFM application and SAP.
*   **Database Impact**: Syncs `LeaveRequest` status changes.
*   **API Endpoints Required**:
    *   `POST /api/v1/sap/sync/leaves` (Bidirectional sync of leave bookings)
*   **UI Screens Affected**:
    *   Web: SAP SuccessFactors Hub (`/sap`) - Leave replication tables.
*   **Estimated Implementation Effort**: 4 Days

### 5.3 Attendance Sync
*   **Business Purpose**: Replicate local verified check-in data into SAP timesheets for salary processing.
*   **Database Impact**: Flags `isSyncedToSap` in `AttendanceRecord` schema.
*   **API Endpoints Required**:
    *   `POST /api/v1/sap/sync/attendance` (Push finalized attendance logs)
*   **UI Screens Affected**:
    *   Web: SAP SuccessFactors Hub (`/sap`) - Timesheet transfer diagnostics.
*   **Estimated Implementation Effort**: 4 Days
