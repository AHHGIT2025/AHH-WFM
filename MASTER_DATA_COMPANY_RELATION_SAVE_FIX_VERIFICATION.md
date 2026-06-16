# Master Data Hub Company Relation Save Mapping Fix Verification Guide

This document details how to verify the fixes for the save/update failure when assigning a Company to Locations, Departments, Cost Centers, and other company-linked master entities.

---

## 1. Problem Descriptions & Root Causes

### Root Cause 1: Empty Company Selection sends `companyId: ""`
When clearing the Company select field in the UI, the frontend dropdown defaulted to sending `companyId: ""` (an empty string). Prisma attempted to write this empty string directly to the database. Since no `Company` with ID `""` exists, the write operation failed with a foreign key constraint violation:
```
Foreign key constraint violated: `companyId` (Prisma code: P2003)
```

### Root Cause 2: Edit Modal sends Normalized & Read-Only fields
When editing a master record, the loaded item has already been normalized to include display-only properties (`code` and `name`) from database-specific columns (like `locationCode` and `locationName`). Additionally, the nested relation object `company` is attached.
When saving, the frontend sent this entire object back to the API. Although the API handler stripped some relation objects, it failed to strip the display-only `code`/`name` fields and read-only fields (`id` on updates, `createdAt`, `updatedAt`). Prisma's strict validation rejected these unknown fields, throwing validation errors.

---

## 2. Implemented Fixes & Scope

### 2.1. Backend Payload Normalization & Validation
We implemented a robust `normalizeMasterPayload(entity, payload, isUpdate)` helper in the GET/POST and PUT/PATCH handlers:
* **nested relation objects** are stripped (`company`, `project`, `location`, etc.).
* **empty relation IDs** (e.g. `companyId: ""`) are converted to `null`.
* **read-only fields** (`id` on updates, `createdAt`, `updatedAt`) are stripped.
* **display-only fields** (`code`, `name`) are mapped into entity-specific database fields (e.g., `locations`: `code` ➔ `locationCode`, `name` ➔ `locationName`) and deleted. If direct fields exist (like `designations`), they are kept.
* **Company verification** is enforced: if `companyId` is provided and is not null, the API verifies the company exists. If not, it returns `400 Bad Request` (`Invalid company selected`). If a required company relation is missing, it returns `400 Bad Request` (`Company is required`).
* **Error logging** has been enhanced to print detailed debug metadata (entity, action, payloads, error code/message) in the terminal.

### 2.2. Frontend Payload Cleaning
We updated `/apps/web/components/master-data/MasterDataEntityTab.tsx`:
* **Edit Modal Initialization**: Standardized `handleOpenModal` to check fallback scalar IDs (`item.companyId || item.company?.id || ""`) so option selection maps correctly.
* **Payload Cleaning**: Modified `handleSave` to strip nested relation objects and map empty select values (`""`) to `null` before sending to the API.

---

## 3. Step-by-Step Manual Verification Checklist

### 3.1. Locations Tab
1. Navigate to **Master Data Hub > Locations**.
2. Click **Add New**.
3. Create a Location with "Select Company" left blank. Verify it saves successfully.
4. Edit the same Location and select a Company (e.g., `AHH — Al Hattab Holding`). Click **Save**. Verify it saves successfully.
5. Reopen the Location modal. Verify the Company persists and the select input defaults correctly to the company name.
6. Clear the Company by choosing "Select Company". Click **Save**. Verify it saves successfully and clears the Company.
7. Create a new Location with Company selected initially. Verify it saves successfully.

### 3.2. Departments / Cost Centers / Projects / Sites
1. Navigate to **Departments**. Verify you can create and edit a department with a Company assigned, and that you can save without error.
2. Navigate to **Cost Centers**. Verify creating and editing a cost center with a Company assigned saves without error.
3. Navigate to **Projects** and **Project Sites**. Verify they save correctly when a company is selected.
4. Verify all list views display `CODE — Company Name` correctly instead of raw UUIDs.

### 3.3. Non-Company Linked Entities (Designations & Trade Classifications)
1. Navigate to **Designations**. Create or edit a Designation. Verify it saves successfully without code/name mapping breaking.
2. Navigate to **Trade Classifications**. Create or edit a Trade Classification. Verify it saves successfully.

### 3.4. Cost Center Dropdown Side-Check (Workforce Directory)
1. Navigate to the **Workforce Directory**.
2. Click **Add Employee** and go to **Work Assignment**.
3. Select a Company (e.g., `AHH`). Verify the Cost Center dropdown populates only with cost centers linked to that company.
4. Verify that options are formatted as `CODE — Name`.
5. If the selected company has no cost centers, verify that the option shows `No cost centers found for selected company`.

### 3.5. Clearance Request Form (`/clearance/new`)
1. Navigate to `/clearance/new`.
2. Confirm the Company filter works and no errors are thrown.
