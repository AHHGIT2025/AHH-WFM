# Company & Cost Center Dropdown Labels & Population Fix Verification Guide

This document details how to verify the fixes for Company and Cost Center dropdown labels, missing company/cost center population, relationship formatting, and cascading company filters.

---

## 1. Problem Descriptions & Root Causes

### Root Cause of UUID Company Labels
In the Master Data Hub table and selection fields, the generic masters API (`/api/v1/masters/[entity]`) did not request the database to join the nested `company` relation for `departments`, `locations`, or `cost-centers` inside its query structure. Because the relation was not loaded, the frontend table was forced to display the raw `companyId` (UUID string) in the Company column instead of the readable company code and name.

### Root Cause of Blank Cost Center Labels
In the dropdown options for Cost Centers inside the Work Assignment tab, the UI was rendering option labels as `cc.name (cc.code)` using standard generic object fields. However, the database schema maps these fields as `costCenterName` and `costCenterCode`. Evaluating these custom names returned `undefined (undefined)` on the options, leading to empty options displaying as `()`.

---

## 2. Implemented Fixes & Scope

### Workforce Directory Company Filter Fix
We updated `fetchDb` on the Workforce page to call the company endpoint `/api/v1/masters/companies` and set the loaded list into the `companies` state (which was previously fetched but left unassigned, resulting in an empty dropdown). We also split the single Status filter into separate **Employment Status** and **Duty Status** filters, allowing discrete filtering against employee statuses.

### Add/Edit Employee Modal Fix
We replaced ad-hoc label maps with robust formatting helpers (`formatCompanyLabel`, `formatDepartmentLabel`, `formatCostCenterLabel`, `formatLocationLabel`, `formatDesignationLabel`, `formatProjectLabel`, `formatProjectSiteLabel`). Dropdown options now cleanly render in `CODE — Name` format with fallback names, preventing any blank options.

### Clearance New Request Sync
We updated the Company filter dropdown in `/clearance/new` to render in `CODE — Company Name` format, resolved employee selector labels to prevent blank listings, and ensured the employee snapshot correctly maps the company relation.

### Cascading Reset Behavior
When the selected Company is changed in the Add or Edit modals:
- Mismatched fields (Department, Cost Center, Location, Project, Site) that do not belong to the newly selected company are reset to empty values.
- A warning notification is dynamically shown at the top of the modal listing the fields that were reset (e.g., `Company changed. The following mismatched selections were cleared: Department, Cost Center`).
### v0.18.3 Stabilization Update
We resolved save and update failures in the Master Data Hub when assigning or clearing companies for Locations, Departments, Cost Centers, and other entities. Incoming payloads are sanitized (nested relations, read-only fields, and display-only fields are stripped, and empty select fields are mapped to null) before database writes, and company existence is validated.

### Build Status
All workspaces build successfully:
- `npx prisma generate` is verified (database schema is already in sync).
- `npm run db:push` verified.
- `npm run build --workspace=apps/web` compiled successfully.
- `npm run build` monorepo build completed successfully.

---

## 3. Step-by-Step Manual Verification Checklist

### 3.1. Master Data Hub Table and Dropdown Display
1. Navigate to **Master Data Hub > Departments** in the web dashboard.
2. Confirm that the **Company** column displays the readable company details as `CODE — Company Name` (e.g. `AHH — Al Hattab Holding`), instead of raw UUID values.
3. Attempt to add a new Department or edit an existing one. In the Company select field, verify that the options are listed as `CODE — Company Name`.
4. Navigate to **Locations** and **Cost Centers**. Confirm that the relations are populated and formatted correctly. No dropdown options show blank labels or empty parentheses like `()`.

### 3.2. Workforce Directory Top Filters
1. Navigate to the **Workforce Directory** page.
2. Confirm that the **Company filter** dropdown at the top is populated and formatted as `CODE — Company Name`.
3. Select a company (e.g., `AHH`). Verify that the employee list filters to show only employees belonging to that company.
4. Verify that the **Department filter** dropdown options filter to show only departments belonging to the selected company.
5. Click **Reset Filters**. Verify that the Company filter clears to "All Companies", the Department filter resets to "All Departments", and the employee grid resets to show all employees.

### 3.3. Add / Edit Employee Modals (Work Assignment Tab)
1. Navigate to **Workforce Directory > Add New Employee > Work Assignment**.
2. Confirm that the **Company** dropdown is populated with company names.
3. Select a company and verify:
   - The **Department**, **Cost Center**, **Default Location**, and **Default Project** dropdown options filter to show only departments belonging to that company.
   - The **Cost Center** dropdown labels show readable labels (`CODE — Name`, e.g., `CC001 — Doha Central`), and do not show blank options or `()`.
4. Fill out the profile, save, and verify they are saved.
5. Open the edit modal for the employee, go to **Work Assignment**, and confirm all selections persist and display correctly.
6. Change the selected **Company** in the edit modal:
   - Verify that any dependent fields that do not match the new company are cleared.
   - Verify that a warning message is displayed at the top of the modal (e.g. `Company changed. The following mismatched selections were cleared: Department, Cost Center`).

### 3.4. Clearance Request Form (`/clearance/new`)
1. Navigate to `/clearance/new`.
2. Verify that the **Company** filter dropdown is populated and formatted as `CODE — Company Name`.
3. Select a company and verify:
   - The **Employee** dropdown filters to display only employees belonging to that company.
   - The **Department** dropdown filters by that company.
4. Verify that no employee options show blank labels, and they are formatted as `EMPLOYEE_CODE — Full Name — Designation`.
5. Select an employee. Verify that the **Employee Snapshot** side-card displays their company and other data correctly.
