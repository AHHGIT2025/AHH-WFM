# System Capability Matrix: AHH WFM

This document provides a comprehensive summary of all completed architectural modules, system capabilities, database schemas, and REST v1 API endpoints for the **AHH WFM** application suite.

---

## 1. Module Capabilities

### 👥 1.1 Employee Directory
- **Description:** Centralized employee directory tracking active working status, departments, shifts, roles, and profiles.
- **Capabilities:**
  - Full CRUD operations with request validation.
  - Soft deactivation support (`isActive = false`) to preserve history.
  - Live status tracking (`On Duty`, `On Break`, `Offline`, `On Leave`).

### ⏰ 1.2 Attendance & Geofencing
- **Description:** GPS-validated clock-in/out and shift compliance validation engine.
- **Capabilities:**
  - **Geofence Boundary Resolution:** Haversine formula calculation checking coordinates within configurable worksite perimeters.
  - **Late Clock-in Detection:** Shift start comparisons logging lateness after a 5-minute grace window.
  - **Double Action Guarding:** Restricts checking in twice, checking out without check-in, inactive employee clocking, and invalid location coordinates.
  - **Effective Attendance Correction:** Retains audited `originalCheckIn` / `originalCheckOut` records while updating effective times upon supervisor approval.

### 📅 1.3 Leave Balance Ledger Engine
- **Description:** Dynamic ledger-based leave allotment calculation engine.
- **Capabilities:**
  - Automated pro-rata monthly accruals.
  - Expiry and carry-over configuration rules.
  - Double-entry balance logging in `LeaveBalanceLedger` for audit compliance.
  - Weekend-aware (Fri/Sat) and holiday-aware deduction calculations.
  - Administrative balance adjustment tools.

### 🔄 1.4 Multi-Level Approvals & SLA
- **Description:** Hierarchical workflow matrices, delegation maps, and escalation checking.
- **Capabilities:**
  - Sequential step progression (e.g. Supervisor $\rightarrow$ Manager $\rightarrow$ HR).
  - Business rules auto-approvals (e.g. Business Travel $\le$ 1 day).
  - Work delegation routing to alternate users within date ranges.
  - Inactivity alerts and auto-escalation after 72 hours.
  - Detailed action step logs (timestamps, remarks, actors).

### 📅 1.5 Shift Scheduling & Rotations
- **Description:** Shift scheduling rosters, cyclical rotations, and conflict checking logic.
- **Capabilities:**
  - **Shift Templates:** Core parameters for Morning, Evening, Night, Split, and Flexible templates.
  - **Rotation Schedules:** Cyclic patterns (5x2, 6x1, 4 On/4 Off) for multi-employee assignments.
  - **Conflict Guarding Engine:** Block assignments to inactive employees, warn on overlaps, and flag leaves.
  - **Safety Rotation Applicator:** Reports conflict warnings instead of silently overriding rosters.

---

## 2. Complete REST v1 API Matrix

All endpoints reside under `/api/v1` and require RBAC verification filters.

| Endpoint | Method | Allowed Roles | Description |
| :--- | :---: | :--- | :--- |
| `/api/v1/employees` | `GET` | ADMIN, SUPERVISOR | Lists all active employees. |
| `/api/v1/employees` | `POST` | ADMIN | Registers a new employee profile. |
| `/api/v1/employees/[id]` | `GET` | ADMIN, SUPERVISOR | Retrieves a single profile. |
| `/api/v1/employees/[id]` | `PUT` | ADMIN, SUPERVISOR | Updates employee details. |
| `/api/v1/employees/[id]` | `DELETE`| ADMIN | Performs soft-deactivation. |
| `/api/v1/departments` | `GET` | ADMIN, SUPERVISOR | Lists operational departments. |
| `/api/v1/departments` | `POST` | ADMIN | Creates a new department. |
| `/api/v1/worksites` | `GET` | ADMIN, SUPERVISOR | Lists all geofence worksites. |
| `/api/v1/worksites` | `POST` | ADMIN | Creates a new worksite with radius. |
| `/api/v1/attendance` | `GET` | ADMIN, SUPERVISOR | Retrieves all attendance logs. |
| `/api/v1/attendance/check-in` | `POST` | ALL | Performs GPS-validated check-in. |
| `/api/v1/attendance/check-out`| `POST` | ALL | Performs check-out check. |
| `/api/v1/attendance/corrections`| `POST` | ALL | Submits a correction request. |
| `/api/v1/attendance/corrections`| `GET` | ADMIN, SUPERVISOR | Lists pending corrections. |
| `/api/v1/attendance/corrections/[id]`| `PUT`| ADMIN, SUPERVISOR | Approves or rejects correction. |
| `/api/v1/leave-types` | `GET` | ALL | Lists configured leave types. |
| `/api/v1/leave-balances` | `GET` | ALL | Retrieves employee balance summary. |
| `/api/v1/leave-balances` | `POST` | ADMIN | Adjusts employee balances manually. |
| `/api/v1/holidays` | `GET` | ALL | Retrieves registered holidays. |
| `/api/v1/leaves` | `GET` | ALL | Lists submitted leave requests. |
| `/api/v1/leaves` | `POST` | ALL | Applies for a new leave request. |
| `/api/v1/leaves/approve` | `POST` | ADMIN, SUPERVISOR | Approves a sequential workflow step. |
| `/api/v1/leaves/reject` | `POST` | ADMIN, SUPERVISOR | Rejects a leave request. |
| `/api/v1/leaves/history` | `GET` | ALL | Retrieves request timeline logs. |
| `/api/v1/approval-workflows`| `GET` | ALL | Lists seeded workflows. |
| `/api/v1/approval-workflows`| `POST` | ADMIN | Adds a custom workflow. |
| `/api/v1/approval-delegations`| `GET`| ALL | Lists registered delegations. |
| `/api/v1/approval-delegations`| `POST`| ALL | Configures a new delegation rule. |
| `/api/v1/shifts/templates` | `GET` | ALL | Lists configured shift templates. |
| `/api/v1/shifts/templates` | `POST` | ADMIN, SUPERVISOR | Creates a new shift template. |
| `/api/v1/shifts/assignments` | `GET` | ALL | Lists active shift assignments. |
| `/api/v1/shifts/assignments` | `POST` | ADMIN, SUPERVISOR | Schedules a single shift assignment. |
| `/api/v1/shifts/assignments/bulk` | `POST` | ADMIN, SUPERVISOR | Bulk assigns shift templates across date ranges. |
| `/api/v1/shifts/assignments/rotations` | `POST` | ADMIN, SUPERVISOR | Applies a rotation template with conflict checking. |
| `/api/v1/shifts/rotations` | `GET` | ALL | Lists configured rotation templates. |
| `/api/v1/shifts/rotations` | `POST` | ADMIN, SUPERVISOR | Creates a new rotation template. |

