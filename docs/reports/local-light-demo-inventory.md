# Local Light Demo Dataset Inventory Report

## Executive Summary
This report inventories the local MySQL development database tables prior to executing the lightweight local demo cleanup (`scripts/local-light-demo-cleanup.ts`). Operational demo tables with high transactional volume (such as 720 generated contracts, 642 manpower requirements, 1,325 field audits, and 678 activity logs) are safely reduced while preserving all system configuration, master lookup data, role/permission matrices, and current operational test fixtures (`SK-90210`, `WC-TEST-8116`).

---

## Detailed Model & Table Inventory

| Model / Table Name | Category | Dependencies | Pre-Cleanup Count | Retained Count | Proposed Deleted |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `_prisma_migrations` | System Master | None | 45 | 45 | 0 |
| `SystemRole` | System Master | `SystemPermission`, `RolePermission` | 32 | 32 | 0 |
| `SystemPermission` | System Master | `RolePermission` | 126 | 126 | 0 |
| `RolePermission` | System Master | `SystemRole`, `SystemPermission` | 2,118 | 2,118 | 0 |
| `Company` | System Master | `Department`, `Employee` | 7 | 7 | 0 |
| `Department` | System Master | `Company`, `Employee` | 6 | 6 | 0 |
| `Designation` | System Master | `Employee` | 8 | 8 | 0 |
| `BlueCollarPositionCategory` | System Master | `Employee` | 14 | 14 | 0 |
| `TradeClassification` | System Master | `Employee` | 4 | 4 | 0 |
| `LocationMaster` | System Master | `Employee`, `Worksite` | 3 | 3 | 0 |
| `CostCenter` | System Master | `Employee` | 3 | 3 | 0 |
| `AllowedPunchLocation` | System Master | `EmployeeAllowedPunchLocation` | 2 | 2 | 0 |
| `Worksite` | Operational Master | `AttendanceRecord` | 1 | 1 | 0 |
| `Shift` | System Master | `Employee`, `ShiftAssignment` | 5 | 5 | 0 |
| `LeaveType` | System Master | `LeaveRequest`, `LeaveBalance` | 6 | 6 | 0 |
| `LeaveBalance` | Operational Data | `Employee`, `LeaveType` | 12 | 12 | 0 |
| `LeaveBalanceLedger` | Operational Data | `LeaveBalance` | 12 | 12 | 0 |
| `LeaveRequest` | Operational Data | `Employee` | 4 | 4 | 0 |
| `LeaveApprovalWorkflow` | System Master | `LeaveApprovalStep` | 3 | 3 | 0 |
| `LeaveApprovalStep` | System Master | `LeaveApprovalWorkflow` | 6 | 6 | 0 |
| `LeaveApprovalHistory` | Operational Data | `LeaveRequest` | 6 | 6 | 0 |
| `Holiday` | System Master | None | 4 | 4 | 0 |
| `SapMapping` | System Master | None | 5 | 5 | 0 |
| `SyncLog` | System Data | None | 3 | 3 | 0 |
| `Announcement` | System Master | None | 2 | 2 | 0 |
| `ShiftTemplate` | System Master | None | 9 | 9 | 0 |
| `RotationTemplate` | System Master | None | 3 | 3 | 0 |
| `OvertimeRate` | System Master | None | 5 | 5 | 0 |
| `ClearanceTemplate` | System Master | `ClearanceTemplateSection` | 2 | 2 | 0 |
| `ClearanceTemplateSection` | System Master | `ClearanceTemplate` | 30 | 30 | 0 |
| `UserOperationAccess` | Security Scope | `Employee` | 3 | 3 | 0 |
| `ManpowerClient` | Operational Master | `ManpowerContract` | 5 | 5 | 0 |
| `ManpowerContract` | Operational Data | `ManpowerClient`, `ContractManpowerRequirement` | 720 | 10 | 710 |
| `ContractManpowerRequirement` | Operational Data | `ManpowerContract`, `RosterRequirementSlot` | 642 | 20 | 622 |
| `ContractRelieverRequirement` | Operational Data | `ManpowerContract` | 58 | 5 | 53 |
| `ContractShiftRequirement` | Operational Data | `ManpowerContract` | 59 | 5 | 54 |
| `RosterRequirementSlot` | Operational Data | `ManpowerContract`, `RosterSlotAssignment` | 532 | 20 | 512 |
| `Employee` | Master/Operational | `Company`, `Department`, `Designation`, `BlueCollarPositionCategory` | 20 | 15 | 5 |
| `SecurityOperationalEmployee` | Master/Operational | `Employee` | 4 | 4 | 0 |
| `AttendanceRecord` | Operational Data | `Employee`, `Worksite` | 18 | 15 | 3 |
| `UserActivityLog` | System Log | `Employee` | 678 | 10 | 668 |
| `SecfacCheckpoint` | Operational Master | `SecfacPatrolRouteCheckpoint` | 32 | 32 | 0 |
| `SecfacChecklistTemplate` | System Master | `SecfacChecklistItem` | 83 | 83 | 0 |
| `SecfacChecklistItem` | System Master | `SecfacChecklistTemplate` | 83 | 83 | 0 |
| `SecfacAssignment` | Operational Data | `Employee`, `SecfacChecklistTemplate` | 170 | 10 | 160 |
| `SecfacChecklistExecution` | Operational Data | `Employee`, `SecfacAssignment` | 87 | 10 | 77 |
| `SecfacChecklistResponse` | Operational Data | `SecfacChecklistExecution` | 54 | 10 | 44 |
| `SecfacChecklistExecutionHistory` | Operational Data | `SecfacChecklistExecution` | 103 | 10 | 93 |
| `SecfacEvidenceAttachment` | Operational Data | `SecfacChecklistExecution` | 11 | 5 | 6 |
| `SecfacScanProof` | Operational Data | `SecfacChecklistExecution` | 54 | 10 | 44 |
| `SecfacPatrolRoute` | Operational Master | `SecfacPatrolRouteCheckpoint` | 8 | 8 | 0 |
| `SecfacPatrolRouteCheckpoint` | Operational Master | `SecfacPatrolRoute`, `SecfacCheckpoint` | 14 | 14 | 0 |
| `SecfacPatrolExecution` | Operational Data | `Employee`, `SecfacPatrolRoute` | 8 | 5 | 3 |
| `SecfacPatrolExecutionCheckpoint` | Operational Data | `SecfacPatrolExecution` | 14 | 5 | 9 |
| `SecfacFieldExecutionAudit` | Operational Data | `SecfacChecklistExecution` | 1,325 | 5 | 1,320 |
| `SecFacAlertRule` | System Master | `SecFacOperationalAlert` | 16 | 16 | 0 |
| `SecFacOperationalAlert` | Operational Data | `SecFacAlertEvent` | 2 | 2 | 0 |
| `SecFacAlertEvent` | Operational Data | `SecFacNotificationAttempt` | 2 | 2 | 0 |
| `SecFacNotificationAttempt` | Operational Data | `SecFacAlertEvent` | 1 | 1 | 0 |
| `SecFacWorkerJob` | System Log | None | 159 | 5 | 154 |

---

## Retained Key Employees
1. `SK-90210` — Sarah Kim (Security Guarding Blue Collar, `positionCategory`: "Security Guard", `designation`: "HR Manager")
2. `WC-TEST-8116` — SEC Guard 2 (Security Guarding Blue Collar, `positionCategory`: "Security Guard")
3. `SEC-1001` — Guard One (Security Guarding Blue Collar, `positionCategory`: "Security Guard")
4. `SEC-1002` — Guard Two (Security Guarding Blue Collar, `positionCategory`: "Security Guard")
5. `SEC-1003` — CCTV Operator One (Security Guarding Blue Collar, `positionCategory`: "Security Guard")
6. `FM-1001` — Cleaner One (Facility Management Blue Collar, `positionCategory`: "Cleaner")
7. `FM-1002` — Cleaner Two (Facility Management Blue Collar, `positionCategory`: "Cleaner")
8. `FM-1003` — Cleaner Three (Facility Management Blue Collar, `positionCategory`: "Cleaner")
9. `FM-1004` — Cleaner Four (Facility Management Blue Collar, `positionCategory`: "Cleaner")
10. `FM-1005` — Cleaner Five (Facility Management Blue Collar, `positionCategory`: "Cleaner")
11. `AD-0001` — System Administrator (White Collar / Admin)
12. `AM-8821` — Alex Martinez (White Collar)
13. `BR-8823` — Brandon Reed (White Collar)
14. `SEC-WC-001` — Zaid Omar (White Collar Supervisor)
15. `SEC-WC-002` — Fatima Noor (White Collar Admin)

---

## Safety Verification
- **Allowed Hosts**: `localhost`, `127.0.0.1`, `::1`.
- **Refused Hosts**: Remote IPs, `10.10.50.24`, production database hostnames.
- **Backup**: Automatically written to `backups/local-data/ahh-wfm-local-before-light-demo-YYYYMMDD-HHmmss.sql` before execution.
