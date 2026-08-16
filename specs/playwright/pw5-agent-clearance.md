# PW-5 Clearance Critical User Journeys

## Overview
Comprehensive Playwright test plan covering Clearance Dashboard, Request Listing & Filtering, Clearance Initiation (Leave/Separation), Department Stage Approvals Queue, Clearance Template Configuration, Case Detail Context, Audit History & Sign-Off, Segregation of Duties, and RBAC / Access Control.

## Scenario 1: Clearance Dashboard & Request Listing Filter
- **Target Route**: `/clearance`
- **User Role**: `ADMIN` / `HR_MANAGER`
- **Actions**: Access Clearance Management dashboard, inspect summary metrics (Total, In Progress, Approved, Completed), filter requests by type (Vacation / Separation) and status, search by employee code or name.
- **Assertions**: Assert Clearance Management header, metrics summary cards, filter select controls, and request list table headers.

## Scenario 2: Clearance Initiation Workflow
- **Target Route**: `/clearance/new`
- **User Role**: `ADMIN` / `HR_MANAGER`
- **Actions**: Select eligible employee, choose clearance type (`LEAVE_VACATION` or `SEPARATION`), specify separation type (`RESIGNATION`, `TERMINATION`, `END_OF_CONTRACT`) or departure/return dates, enter remarks, submit to initialize approval workflow.
- **Assertions**: Assert employee select dropdown, clearance type radio/select, date pickers, remarks field, and submit button.

## Scenario 3: Department Stage Approvals Queue
- **Target Route**: `/clearance/approvals`
- **User Role**: `HR_MANAGER` / `DEPARTMENT_APPROVER` / `ADMIN`
- **Actions**: View pending department approval steps (Supervisor, IT, Finance, HR, Executive), review clearance details, execute action (`Approve`, `Reject`, `Return`, or `Mark N/A`).
- **Assertions**: Assert approvals queue table, stage badge indicators, action buttons, and modal dialog for remarks/rejection reason.

## Scenario 4: Clearance Template & Section Configuration
- **Target Route**: `/clearance/templates`
- **User Role**: `ADMIN`
- **Actions**: Inspect clearance workflow templates (Leave / Vacation Clearance, Separation Clearance), view section steps (Direct Supervisor, IT Assets, Finance, Housing, HR Final Sign-off), default approver roles, and checklist items.
- **Assertions**: Assert template list, section hierarchy, active status toggles, and section step order numbers.

## Scenario 5: Clearance Case Context & Stage Audit History
- **Target Route**: `/clearance/[id]`
- **User Role**: `ADMIN` / `HR_MANAGER` / `EMPLOYEE`
- **Actions**: View clearance case detail page, employee snapshot fields (Employee Code, Designation, Department, QID, Passport), stage completion timeline, approval responses, and immutable audit history log.
- **Assertions**: Assert employee snapshot card, progress stepper, stage response status badges, and timestamped audit history timeline.

## Scenario 6: Role-Based Access Control & Action Authorization
- **Target Route**: `/clearance` & `/clearance/templates`
- **User Role**: `RESTRICTED_EMPLOYEE` vs `ADMIN`
- **Actions**: Verify navigation bar visibility for Clearance, test direct URL navigation authorization, verify restricted roles cannot access template administration or execute unauthorized stage sign-offs.
- **Assertions**: Assert sidebar link filtering, page access restriction, disabled or hidden management buttons for restricted roles.
