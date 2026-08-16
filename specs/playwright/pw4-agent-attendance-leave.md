# PW-4 Attendance & Leave Critical User Journeys

## Overview
Comprehensive Playwright test plan covering Attendance Monitor, Employee Attendance Records, Punch Check-In/Out, Late/Absent Exceptions, Manual Attendance Corrections, Leave Request Lifecycle, Leave Approvals/Rejections, Leave Balances, Calendar & Work Profile Integration, Roster Consistency, and RBAC / SoD boundaries.

## Scenario 1: Attendance Monitor & Executive Dashboard
- **Target Route**: `/attendance`
- **User Role**: `ADMIN` / `HR_MANAGER`
- **Actions**: View Attendance Monitor summary metrics, period selector, status filters, and employee attendance list.
- **Assertions**: Assert visibility of Attendance Monitor header, present/absent/late metric counts, and filter controls.

## Scenario 2: Employee Attendance Record & Detail Context
- **Target Route**: `/attendance`
- **User Role**: `ADMIN` / `ATTENDANCE_OFFICER`
- **Actions**: View detailed employee attendance row, scheduled shift, punch-in time, punch-out time, work location, and calculated status.
- **Assertions**: Assert employee name, date context, punch timestamps, and status indicator visibility.

## Scenario 3: Check-In & Check-Out Punch Execution
- **Target Route**: `/employee/punch`
- **User Role**: `EMPLOYEE` / `ADMIN`
- **Actions**: View punch interface, punch mode selection, check-in action, and check-out action.
- **Assertions**: Assert punch action buttons, current timestamp display, and location context.

## Scenario 4: Late Arrival, Absence, and Exception Determination
- **Target Route**: `/attendance`
- **User Role**: `ADMIN` / `ATTENDANCE_OFFICER`
- **Actions**: Inspect calculated attendance exceptions, late arrival indicators, missing punch flags, and unexcused absence listings.
- **Assertions**: Assert exception badges (`LATE`, `ABSENT`, `MISSING_PUNCH`), and exception resolution actions.

## Scenario 5: Manual Attendance Correction & Workflow Submission
- **Target Route**: `/attendance`
- **User Role**: `ADMIN` / `ATTENDANCE_OFFICER`
- **Actions**: Initiate manual attendance correction request, specify proposed punch time and reason, submit for workflow approval.
- **Assertions**: Assert correction modal/form controls, reason field, and submission trigger.

## Scenario 6: Leave Request Submission & Balance Indication
- **Target Route**: `/leave`
- **User Role**: `EMPLOYEE` / `ADMIN`
- **Actions**: View leave request portal, leave type selection (Annual, Sick, Emergency), date range, reason input, and available leave balance summary.
- **Assertions**: Assert leave application form, start/end date pickers, remaining balance widget, and submit action.

## Scenario 7: Leave Approval, Return, and Rejection Governance
- **Target Route**: `/leave`
- **User Role**: `SUPERVISOR` / `HR_MANAGER` / `ADMIN`
- **Actions**: View pending leave approval queue, review request details, execute approval or rejection with mandatory remarks.
- **Assertions**: Assert approval action triggers, remarks dialog, and updated leave status badge (`APPROVED` / `REJECTED`).

## Scenario 8: Calendar Hierarchy, Holiday, and Ramadan Rules
- **Target Route**: `/settings/manpower-calendars`
- **User Role**: `ADMIN`
- **Actions**: Inspect global company calendars, holiday definitions, department overrides, and seasonal Ramadan work hours adjustment.
- **Assertions**: Assert calendar listing grid, holiday entries, and seasonal Ramadan schedule profile.

## Scenario 9: Roster & Attendance Consistency Verification
- **Target Route**: `/attendance`
- **User Role**: `ADMIN` / `OPERATIONS_MANAGER`
- **Actions**: Verify alignment between published shift roster assignments and recorded attendance entries for active duty shifts.
- **Assertions**: Assert roster shift code matching attendance record, preventing unassigned absence generation.

## Scenario 10: Role-Based Access Control & Scope Isolation
- **Target Route**: `/attendance` & `/leave`
- **User Role**: `RESTRICTED_EMPLOYEE`
- **Actions**: Attempt unauthorized management actions or direct URL navigation to administrative settings.
- **Assertions**: Assert role-restricted navigation filtering and direct URL access restriction.
