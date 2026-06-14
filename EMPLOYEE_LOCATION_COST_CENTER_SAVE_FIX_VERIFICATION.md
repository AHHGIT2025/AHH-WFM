# Employee Location & Cost Center Save Fix Verification

## 1. Root Cause Analysis
During editing and saving of employee profiles via the `/admin/workforce` module, several fields including `Default Location` and `Cost Center` were appearing temporarily selected but were reverting to their blank/default state upon refreshing or reopening the modal.

The root cause was identified in the REST API controllers:
* `apps/web/app/api/v1/employees/[id]/route.ts` (PATCH endpoint)
* `apps/web/app/api/v1/employees/route.ts` (POST endpoint)

The UI was correctly packaging the `defaultLocationId` and `costCenterId` attributes into the JSON payload (as observed in `apps/web/app/workforce/page.tsx`), and the persistence layer (`mockDb.updateEmployee`) natively supported generic data patching. However, the Next.js API endpoints were explicitly destructuring a hardcoded list of scalar properties and dropping the new schema attributes from the incoming payload before sending them to the persistence layer.

## 2. Fields Fixed & Changes Implemented
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
- **API Payload Validation**: The API correctly processes and returns HTTP `200` containing the bound `defaultLocationId` and `costCenterId`.
- **Database Persistence**: Saving values correctly persists into the `Employee` table (MySQL database `schema.prisma` mapping).
- **Fallback Integration**: Local JSON fallback correctly utilizes `Object.assign()` with the full payload properties.
- **UI State**: Modal reopening correctly initializes using `(emp as any).costCenterId || ""` and `(emp as any).defaultLocationId || ""`.
- **Build Pass**: Build correctly compiles without type errors.
