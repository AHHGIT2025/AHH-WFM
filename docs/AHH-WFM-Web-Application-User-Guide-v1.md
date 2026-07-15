# AHH WFM Web Application User Guide

---

# 1. Cover Page

**Title**: AHH WFM Web Application User Guide  
**Prepared for**: Al Hattab Holding  
**Version**: 1.0  
**Date**: July 2026  

---

# Table of Contents
1. [Cover Page](#1-cover-page)
2. [Introduction](#2-introduction)
3. [Login and Dashboard](#3-login-and-dashboard)
4. [User Roles and Access](#4-user-roles-and-access)
5. [Workforce Directory](#5-workforce-directory)
6. [Master Data Hub](#6-master-data-hub)
7. [Settings](#7-settings)
8. [Main White Collar Shift Planner](#8-main-white-collar-shift-planner)
9. [Security Guarding Operations](#9-security-guarding-operations)
10. [Security Manpower Sync](#10-security-manpower-sync)
11. [Contract Management](#11-contract-management)
12. [Project Management](#12-project-management)
13. [Site Management](#13-site-management)
14. [Security Shift Planner](#14-security-shift-planner)
15. [Reliever Pool](#15-reliever-pool)
16. [Facility Management Operations](#16-facility-management-operations)
17. [Attendance](#17-attendance)
18. [Leave](#18-leave)
19. [Reports](#19-reports)
20. [Common Issues and Troubleshooting](#20-common-issues-and-troubleshooting)
21. [Best Practices](#21-best-practices)

---

# 2. Introduction

The Al Hattab Holding Workforce Management (AHH WFM) platform is an enterprise-class solution designed to streamline workforce directory management, schedule planning, compliance tracking, and site deployments. The system acts as the centralized engine to manage operations across multiple subsidiaries, handling both high-level HR records and day-to-day dynamic shift schedules.

## Core Capabilities
*   **Workforce Directory**: Centralized Master Directory for all employees, tracking categories (White Collar vs. Blue Collar), default locations, cost centers, and status.
*   **Settings & Compliance**: Advanced workflow delegations, role assignment, and audit logs.
*   **Rosters & Attendance**: Mobile clock-in/check-out boundaries with geofence validation.
*   **Security Guarding Operations**: Scope-decoupled shift planning using operational manpower sync, contract lifecycles, project sites, and gate passes.
*   **Facility Management Operations**: Separate operational scope to schedule and deploy FM teams.
*   **Advisories & Reporting**: Advisory tools for payroll calculations and billing support.

---

# 3. Login and Dashboard

## 3.1 Accessing the Application
1. Navigate to the login page via the following URLs:
   - **Local environment**: [http://localhost:3100/login](http://localhost:3100/login)
   - **Production/Server environment**: [http://10.10.50.24:3200/login](http://10.10.50.24:3200/login)
2. Enter your corporate email and password. *Note: Use the credentials provided by your system administrator.*
3. Click the **Submit** button.

![Login Page](./screenshots/01-login.png)

## 3.2 Main Dashboard
Upon successful login, you will land on the Main Dashboard:

![Main Dashboard](./screenshots/02-dashboard.png)

### Dashboard Elements:
*   **Active Directory Metrics**: View counts of total active, white collar, and blue collar employees.
*   **Subsidiary Switcher**: Toggle view between different Al Hattab Holding subsidiaries (e.g. Al Hattab Security tc01,tc02).
*   **Navigation Menu**: The left sidebar provides quick links to the Workforce Directory, Settings, Shifts, Security Guarding, and FM workspaces.
*   **User Profile & Logout**: Access user profile details and sign out safely.

---

# 4. User Roles and Access

Access is strictly controlled by Role-Based Access Control (RBAC):

| Role Name | Description / Access Rights |
| :--- | :--- |
| **SUPER_ADMIN** | Full system read/write access. Configure global settings, integrations, and master tables. |
| **ADMIN** | Manage departments, companies, employee profiles, and overall company settings. |
| **HR_USER** | Manage the Workforce Directory (add, edit, toggle active status). No operations planning. |
| **SECURITY_USER** | Operational planner for Security Guarding. Decoupled access only to Security Guarding sync/shift planner. |
| **FACILITY_MANAGEMENT_USER** | Operational planner for FM. Access to FM deployment planner. |
| **COORDINATOR** | On-site supervisor. View shift allocations, submit gate passes and inspections. |
| **EMPLOYEE** | Read-only portal. Request leave and view personal attendance history. |

> [!IMPORTANT]
> **Operational Decoupling Rule**: Security Guarding and Facility Management operations are fully isolated. FM users cannot view or allocate Security guards, and Security users cannot view FM project assignments.

---

# 5. Workforce Directory

The Workforce Directory serves as the master database for all employees.

![Workforce Directory List](./screenshots/03-workforce-directory.png)

## 5.1 Adding a New Employee
1. Navigate to **Workforce Directory** on the main menu.
2. Click the **Add Employee** button.
3. Fill out the required fields:
   *   **Full Name**, **Email**, **Role** (e.g., EMPLOYEE).
   *   **Employee Category**: Choose **White Collar** or **Blue Collar**.
   *   **Company & Department**: Assign to a specific subsidiary and department.
   *   **Default Location**: (Required for White Collar) Assign default office.
4. Click **Save**.

![Add Employee Form](./screenshots/04-add-employee.png)

## 5.2 Editing an Employee
1. Find the employee in the directory.
2. Click **Edit** to open the profile page.
3. Update fields (e.g., toggle active/inactive status) and click **Update**.

![Edit Employee Profile](./screenshots/05-edit-employee.png)

> [!IMPORTANT]
> **Workforce Directory Rule**: The Workforce Directory remains the HR employee master. Deactivating an employee here will automatically prevent them from being rostered in operations.

---

# 6. Master Data Hub

Configure system-wide settings, companies, and locations.

## 6.1 Companies Management
*   **Action**: Create new company profiles (e.g. Al Hattab Security, Al Hattab Services).

![Companies List](./screenshots/06-companies.png)

## 6.2 Departments Management
*   **Action**: Manage cost centers and department references.

![Departments List](./screenshots/07-departments.png)

> [!NOTE]
> **Department Scoping**: Departments are company-wise. The same department name can exist under different companies (e.g., `Operations` cost center is distinct under TC01 vs HS01).

## 6.3 Locations Management
*   **Action**: Setup office and site location masters.

![Locations List](./screenshots/08-locations.png)

---

# 7. Settings

Centralized control settings for administrators.

## 7.1 Users and Roles Setup
*   **Action**: Invite new users, assign security group permissions.

![Settings - Users](./screenshots/09-settings-users.png)

## 7.2 Roles and Permissions
*   **Action**: Custom permissions configurations.

![Settings - Roles](./screenshots/10-settings-roles.png)

## 7.3 Centralized Workflow Setup
*   **Action**: Setup approval rules for leave requests and gate passes.

![Settings - Workflows](./screenshots/11-settings-workflows.png)

> [!IMPORTANT]
> **Workflow Centralization**: Workflow setup is centralized under Settings, not configured inside individual contracts.

## 7.4 Announcements and Audit Logs
*   **Action**: Track global announcements and view the audit logs for system edits.

![Settings - Announcements](./screenshots/12-settings-announcements.png)
![Settings - Audit Logs](./screenshots/13-settings-audit.png)

---

# 8. Main White Collar Shift Planner

The main shift planner is designed exclusively for White Collar employees to plan default office schedules.

![White Collar Shift Planner](./screenshots/14-shifts.png)

## 8.1 Key Rules
1. Only **White Collar** category employees appear here.
2. Schedule details default to their assigned **Employee Default Location**.
3. Blue Collar employees do not appear here.

---

# 9. Security Guarding Operations

The Security Guarding workspace is decoupled from the main HR directory to provide stable deployment planning.

![Security Guarding Dashboard](./screenshots/15-security-dashboard.png)

## 9.1 Compliance Ledger
Manage required Ministry of Interior (MOI) security credentials.

![MOI Security Licenses](./screenshots/26-security-licenses.png)

## 9.2 Site Gate Passes
Input gate pass approvals for restricted worksites.

![Site Gate Passes](./screenshots/25-security-gate-passes.png)

## 9.3 Inspections Ledger
Log patrols, checklist updates, and site scoring.

![Inspections Ledger](./screenshots/27-security-inspections.png)

---

# 10. Security Manpower Sync

The source HR employee master remains in the Workforce Directory, while Security Guarding maintains its own operational copy/snapshot of manpower records after sync. This ensures deployment planning, shift planner, and the guard pool are not unexpectedly disturbed by every HR master-data edit.

![Security Manpower Sync](./screenshots/16-security-manpower.png)

## 10.1 Syncing Steps:
1. Navigate to **Security Guarding** -> **Manpower**.
2. Unsynced employees will show a status of **Needs Sync**.
3. Click the **Sync Manpower** button.
4. The employee record is converted to a Security operational copy.
5. HR can still edit the employee in the Workforce Directory, but the Security snapshot changes only after a controlled re-sync.

---

# 11. Contract Management

Contracts define client requirements, billing scopes, and authorized manpower limits.

![Contract List](./screenshots/17-security-contracts.png)

## 11.1 Contract Lifecycles
*   **Draft**: Editable and deletable. Click **Submit** to route for approval.
*   **Approved**: Ready to be activated.
*   **Active**: Authorized for project allocation. You can add addendums.
*   **Terminated**: View-only history.

> [!WARNING]
> **Addendum Rule**: Contract addendums can only be added to **ACTIVE** contracts.

---

# 12. Project Management

Create projects under active contracts and allocate contract manpower.

![Project List](./screenshots/18-security-projects.png)

## 12.1 Key Rules
*   Create projects under contract.
*   Allocate manpower from contract pool.
*   Project allocation consumes contract manpower.

---

# 13. Site Management

Define worksites, geofence coordinates, and shift requirements.

![Site List](./screenshots/19-security-sites.png)

## 13.1 Key Rules
*   Site belongs to project.
*   Site allocation consumes project allocation.
*   Site allowance is advisory only.
*   Site geofence is used for mobile attendance.
*   Site shift requirements are used by Shift Planner.

> [!CAUTION]
> **Site Delete Dependency**: You cannot delete a site that has active shift requirements, site allowance configurations, gate passes, or historical attendance logs.

---

# 14. Security Shift Planner

Plan, assign, and lock rosters.

![Security Shift Planner](./screenshots/20-security-deployments.png)

## 14.1 Scheduling Steps
1. Select the target **Date**.
2. Select the **Site** and **Shift Requirement** slot.
3. Click on the slot to open the **Available Guard Pool**.
4. Select a guard from the pool. Conflict checks (overlap shifts, leave status) run in real time.
5. Click **Assign**.
6. When the week's schedule is finalized, click **Period Lock** to prevent edits.

---

# 15. Reliever Pool

Separate reliever management to ensure continuous coverage.

![Reliever Pools](./screenshots/21-security-relievers.png)

## 15.1 Key Rules
*   Relievers are separate from permanent contract counts.
*   The system checks reliever assignments to prevent double-allocations.

---

# 16. Facility Management Operations

Isolated FM module to schedule and deploy facility maintenance teams.

![FM Dashboard](./screenshots/28-facility-dashboard.png)
![FM Manpower](./screenshots/29-facility-manpower.png)
![FM Deployments](./screenshots/30-facility-deployments.png)

## 16.1 Key Rule
*   FM operations read from standard `EmployeeDeployment` configurations, completely isolated from Security.

---

# 17. Attendance

View records, mobile clock-ins, and geofence verification details.

![Attendance Ledger](./screenshots/31-attendance.png)

## 17.1 Mobile Current Duty Resolution Rules:
*   **White Collar**: Duty resolved from **Employee Default Location** (Office).
*   **Security Blue Collar**: Duty resolved from today's active **Shift Planner** site assignment.
*   **FM Blue Collar**: Duty resolved from today's **FM Deployment** site.

---

# 18. Leave

View leave records. Approved leaves automatically exclude employees from the operational availability pool.

![Leave Ledger](./screenshots/32-leave.png)

---

# 19. Reports

Access the analytics and payroll advisory preparation dashboards.

![Reports Hub](./screenshots/33-reports.png)

## 19.1 Key Rules
*   **Payroll Advisory Prep**: Generate logs of shift hours, overtime, and late minutes. *Note: Payroll Advisory is advisory only; the system does not calculate actual payroll or bank postings.*
*   **Billing-Support Reports**: Generate summary sheets of site deployments to support billing invoicing. *Note: Billing-Support reports do not create finance invoices or postings.*

---

# 20. Common Issues and Troubleshooting

| Issue Description | Likely Root Cause | Solution / Troubleshooting Step |
| :--- | :--- | :--- |
| **Employee not showing in Available Guard Pool** | The employee is on approved leave, has an overlapping shift assignment, or has not been synced yet. | 1. Check leave roster.<br>2. Check if already assigned to a shift.<br>3. Go to Security Manpower Sync and verify status is "Synced". |
| **Current Duty shows "Not Assigned"** | The employee has no active deployment for today. | 1. White Collar: Ensure default location is set in Workforce Directory.<br>2. Blue Collar: Verify shift is assigned in Shift Planner. |
| **Target Geofence Location shows "Not Configured"** | Default location or active site is missing coordinates. | 1. Go to Locations Master (White Collar) or Site Master (Blue Collar).<br>2. Fill in Lat/Lng and Geofence Radius. |
| **Site cannot be deleted** | The site has historical dependencies (attendance, requirements). | 1. Deactivate instead of delete.<br>2. Clear future shift requirements and assignments first. |

---

# 21. Best Practices

1. **HR Directory First**: Always create the employee record in the main Workforce Directory first.
2. **Category Configuration**: Verify the employee category (White/Blue) is correct on profile creation.
3. **Synchronize Operational Copy**: Always sync Security Guards to the operational snapshot before planning rosters.
4. **Setup Geofences**: Configure site Lat/Lng and radius prior to deploying guards to ensure mobile check-in works correctly.
5. **Use Period Lock**: Apply period locks on finalized rosters to secure attendance calculations.
