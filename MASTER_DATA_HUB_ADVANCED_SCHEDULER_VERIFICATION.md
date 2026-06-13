# Master Data Hub & Advanced Scheduler Verification

> **Release Checkpoint**: `v0.15-master-data-scheduler-mobile-integration`
## 1. Master Data Hub Verification
The Master Data Hub provides centralized management for all foundational AHH structural data.

### Completed Screens & Endpoints:
- **Companies**: Holding structure root records (`/api/v1/masters/companies`).
- **Departments**: Internal groupings mapping to SAP (`/api/v1/masters/departments`).
- **Designations**: Hierarchical job roles (`/api/v1/masters/designations`).
- **Trades**: Worker specific blue-collar trades (`/api/v1/masters/trades`).
- **Locations**: Master locations mapped to GPS coordinates (`/api/v1/masters/locations`).
- **Cost Centers**: Mapping between AHH projects and SAP financials (`/api/v1/masters/cost-centers`).
- **Projects & Sites**: The deployment structure for field workers (`/api/v1/masters/projects` & `sites`).
- **Allowed Punch Locations**: Specialized authorized geofences for specific exceptions (`/api/v1/masters/punch-locations`).
- **Standby Rules**: Criteria for auto-suggesting relievers (`/api/v1/masters/standby-rules`).

### Dynamic UI Mechanism:
A generic React component (`MasterDataEntityTab`) dynamically renders CRUD forms, search fields, and status toggles for any master entity passed in through configuration.

## 2. Advanced Scheduler (Grid Planning Board)
The Advanced Scheduler (`/shifts/page.tsx`) incorporates deep cell-action capabilities:
- **Assign / Split Shifts**: Standard template or split-shift mapping to `ShiftAssignment`.
- **Leave / Vacation / Off**: Direct state mutations driving `AttendancePolicy` and `LeaveRequest` models.
- **Project/Site Deployment**: Dynamically shifts Blue Collar workers to new physical geofences (`EmployeeDeployment`), which overrides their mobile punch permissions.
- **On-Call Assignment**: Dynamically assigns workers to custom on-call sites or locations (`OnCallAssignment`), updating their mobile access.
- **Reliever / Cover Assignment**: Applies the Standby Rules to link a Standby employee to an active absence.

## 3. Web-to-Mobile Integration Check
All Web-created data properly propagates to the mobile BFF:
- Projects, Sites, and Custom Allowances immediately modify the payload returned by `GET /api/v1/allowed-punch-locations`.
- Deployment and On-Call assignments dynamically override static rules in real-time.
