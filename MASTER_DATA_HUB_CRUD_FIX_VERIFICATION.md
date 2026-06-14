# Master Data Hub CRUD Fix Verification

## Summary of Fixes

### 1. Root Cause Analysis
The primary issue was that the generic master data UI component (`MasterDataEntityTab`) was hardcoded to use the `PUT` HTTP method when saving an edited record. However, the Next.js API routes were inconsistent:
- The generic `[entity]/[id]/route.ts` only exposed `PUT` and `DELETE`, not `PATCH`.
- Legacy overriding route handlers existed in directories like `locations`, `cost-centers`, `designations`, and `trade-classifications`. These legacy directories incorrectly proxied to a deprecated `mockDb` service instead of the unified Prisma database, breaking both the generic routing structure and the actual data flow.
- Furthermore, the generic `entityMap` lacked an entry for `departments`, causing `/api/v1/masters/departments` to throw a `400 Invalid master entity` error.

### 2. Routes Fixed
- **Cleaned Up Legacy Overrides**: Removed the obsolete directories (`locations`, `cost-centers`, `designations`, `trade-classifications`) from `/api/v1/masters/` so that all traffic safely falls through to the generic `[entity]` handler which correctly interacts with Prisma.
- **Enabled `PATCH` Support**: Added an explicit `export async function PATCH` to `/api/v1/masters/[entity]/[id]/route.ts` which forwards to the existing `PUT` logic. Both `PUT` and `PATCH` are now supported uniformly across all master entities.
- **Fixed `departments` Mapping**: Appended `departments: "department"` to the `entityMap` in both `[entity]/route.ts` and `[entity]/[id]/route.ts`. 

### 3. UI Method Changes
- **Updated `MasterDataEntityTab.tsx`**: Changed the update request method from `PUT` to `PATCH`. 
- **Improved Error Handling**: Modified the `.catch` blocks in `handleSave` and `handleToggleStatus` so that it parses and displays the actual server error JSON payload (e.g., `"Record not found"`, `"Invalid master entity"`), replacing the generic `"Network error"` alert. All network errors and unexpected payload responses are now strictly logged to `console.error` for deeper inspection.
- **Aligned Endpoint Paths**: Corrected the `apiPath` values inside `/admin/masters/page.tsx` for Trade Classifications (`trades` -> `trade-classifications`), Project Sites (`sites` -> `project-sites`), and Allowed Punch Locations (`punch-locations` -> `allowed-punch-locations`), ensuring flawless matching with `entityMap`.

### 4. Department API Fix
By mapping `departments` to Prisma's `department` model, `GET /api/v1/masters/departments` now successfully returns a list of departments instead of a `400` error, and `POST` correctly creates new records.

## Verification Checklist

- [x] **Location Updates**: Editing a location like `LOC-001` via the `/admin/masters` UI correctly triggers a `PATCH /api/v1/masters/locations/LOC-001` request, successfully returning `200 OK` and persisting changes to the Prisma DB.
- [x] **Department Support**: `GET /api/v1/masters/departments` and `POST /api/v1/masters/departments` have been verified to function correctly without throwing `400` errors.
- [x] **Universal Entity Mapping**: Verified that all 10 entities map cleanly to Prisma without legacy collision.
- [x] **String IDs**: Confirmed that `LOC-001` format string IDs correctly pass through the Prisma `where: { id }` filters.
- [x] **Compilation**: `npm run build` succeeds under the `@ahh-wfm/web` workspace without routing conflicts.
