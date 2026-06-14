# Employee Location & Cost Center Save Fix Verification

## 1. Root Cause Analysis
During editing and saving of employee profiles via the `/admin/workforce` module, several fields including `Default Location`, `Cost Center`, `Designation`, `Trade`, `Reliever`, and `Standby` were appearing temporarily selected but were reverting to their blank/default state upon refreshing or reopening the modal.

The root cause was identified in the REST API controllers:
* `apps/web/app/api/v1/employees/[id]/route.ts` (PATCH endpoint)
* `apps/web/app/api/v1/employees/route.ts` (POST endpoint)

The UI was correctly packaging these attributes into the JSON payload (as observed in `apps/web/app/workforce/page.tsx`), and the persistence layer (`mockDb.updateEmployee`) natively supported generic data patching. However, the Next.js API endpoints were explicitly destructuring a hardcoded list of scalar properties and dropping the new schema attributes from the incoming payload before sending them to the persistence layer.

## 2. Files Changed & Fields Fixed
The following fields are now properly destructured, validated, and passed to the database update payloads:
* `defaultLocationId`
* `costCenterId`
* `designationId`
* `tradeClassificationId`
* `isRelieverEligible`
* `isStandbyEligible`

### Modified Files:
* `apps/web/app/api/v1/employees/[id]/route.ts`: Updated `PATCH` object mapping.
* `apps/web/app/api/v1/employees/route.ts`: Updated `POST` object mapping.

## 3. API Payload Changes
The destructured payload mapping now mirrors the complete Employee frontend model state for Blue Collar/White Collar, Cost Center, Location, and Advanced Scheduling traits.

Before:
```javascript
const { name, email, role, departmentId, status, phone, shiftId, employmentStatus, dutyStatus, workerCategory, positionCategoryId, defaultProjectId, defaultSiteId } = payload;
```

After:
```javascript
const { 
  name, email, role, departmentId, status, phone, shiftId, 
  employmentStatus, dutyStatus, workerCategory, positionCategoryId, 
  defaultProjectId, defaultSiteId, designationId, tradeClassificationId, 
  costCenterId, defaultLocationId, isRelieverEligible, isStandbyEligible 
} = payload;
```

## 4. Backend Persistence Changes
Both the `PATCH` and `POST` handlers explicitly pass these keys to `mockDb.updateEmployee()` and `mockDb.createEmployee()`, mapping empty strings `""` to `null` or `undefined` depending on the database driver constraints to ensure strict relational integrity checks.

## 5. Verification Results

### MySQL Verification
- Checked database persistence using Prisma. Values for `defaultLocationId` and `costCenterId` correctly map to their respective relations in the `Employee` table without constraints blocking the payload.

### JSON Fallback Verification
- Evaluated `updateEmployee` logic under `isDbConnected() === false`. The `Object.assign()` mechanism applies the new properties natively to the in-memory array seamlessly.

### UI Reopen/Refresh Verification
- **Edit default location/cost center and save:** Value properly sent to server.
- **Reopen modal:** UI component initializes correctly binding to `emp.defaultLocationId` and `emp.costCenterId`.
- **Refresh browser:** API `GET /api/v1/employees` serves updated row state; component selects accurate locations.
- **Edit designation/trade:** Both persist effectively through the Blue Collar profile flow.
- **Toggle reliever/standby:** Booleans accurately store and rehydrate.

### Build Result
- Workspace build `npm run build --workspace=apps/web` and monorepo build `npm run build` executed successfully with `0` errors.
