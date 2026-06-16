# Release Notes: v0.18.3 - Master Data Company Relation Save Mapping Fix

We are pleased to announce the release of **v0.18.3**, which addresses save and update failures when assigning companies to master data entities in the Master Data Hub. This release stabilizes the data relation mapping layers between the frontend user interface, API endpoints, and the MySQL database schemas.

---

## What's New

### 1. Robust API Payload Normalization
* **Nested Relations Stripped**: Cleaned up the generic `/api/v1/masters/[entity]` and `/[entity]/[id]` endpoints to strip nested relation objects (such as `company`, `project`, `location`, `department`, `costCenter`, `site`) before sending data to the Prisma query engine.
* **Empty Relation IDs Map to Null**: Implemented mapping to convert empty relation strings (`companyId: ""`) to `null`. This prevents MySQL database foreign key constraint violations (Prisma code `P2003`) on optional fields.
* **Read-only & Display Field Stripping**: Removed system-managed fields (`id`, `createdAt`, `updatedAt`) and display-only fields (`code`, `name`) from incoming payloads before saving.
* **Entity-Specific Property Translation**: Added logic to automatically map UI standard `code` and `name` properties to entity-specific database columns (e.g. `locationCode`/`locationName` for Locations, `costCenterCode`/`costCenterName` for Cost Centers, `projectCode`/`projectName` for Projects).

### 2. Company Association Safeguards
* **Company Existence Verification**: Enforced validation checks on `POST` and `PUT`/`PATCH` endpoints to verify that the referenced `companyId` exists in the database. Returns a clean `400 Bad Request` with `{ error: "Invalid company selected" }` if the company does not exist.
* **Required Relations Validation**: Standardized checks to ensure entities requiring a company relation (such as Allowed Punch Locations) cannot be saved without a valid company, returning `{ error: "Company is required" }`.

### 3. Frontend Form Binding Fixes
* **Dropdown Selection Defaults**: Updated the `MasterDataEntityTab` component to initialize edit form fields using fallback scalar IDs (`item.companyId || item.company?.id || ""`), ensuring company selections render correctly upon editing.
* **Frontend Payload Sanitization**: Configured the frontend save action to strip nested relation objects and map empty select dropdown values to `null` before making HTTP calls.

### 4. Cost Center Filtering Side-Check
* Verified that the `/api/v1/masters/cost-centers` API includes the company relation in GET requests.
* Verified that the Workforce Directory employee creation/edit modal filters Cost Centers dynamically by company and renders options as `CODE — Name` with proper empty fallback notifications (`No cost centers found for selected company`).

---

## Verification & Build Status
* All 5 automated unit tests for payload normalizers and relation validations passed.
* Verified TypeScript compilation and Next.js workspace builds successfully.
