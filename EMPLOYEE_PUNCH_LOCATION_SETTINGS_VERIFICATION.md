# Employee Punch Location Settings Verification

## 1. Objective
To verify that granular punch policies (multiple allowed punch locations, default locations, policy overrides) are correctly integrated into the core `Employee` model, editable in the `Workforce` module UI, and actively enforced in the Mobile App's Check-in flow.

## 2. Requirements Addressed
* **Employee Punch Policy Fields**: Fully mapped boolean toggles (`allowMultiplePunchLocations`, etc.) and radius overrides.
* **defaultPunchLocationId Behavior**: Separated `defaultLocationId` (HR/Cost Center) from `defaultPunchLocationId` (Mobile Geofence rule).
* **EmployeeAllowedPunchLocation Behavior**: Created the relational joining table explicitly to let a single employee punch in from multiple overlapping authorized sites securely.
* **UI Changes in Workforce Edit Modal**: Fixed the dropdown error yielding blank names "()" and added a comprehensive "Mobile Punch Location Settings" pane.
* **Mobile BFF Check-in Cascade**: Mobile check-in now traverses locations sequentially: Deployment -> On-call -> Default -> Allowed -> Office -> Fallback.
* **Out-of-zone Review Behavior**: Check-ins falling outside bounds where `allowOutOfZonePunch` and `requireOutOfZoneReview` are true now flag as `OUT_OF_ZONE_REVIEW_REQUIRED`.

## 3. Test Cases Performed

### 3.1 Backend & Schema
- [x] **Prisma Compilation**: `npx prisma generate` executed successfully.
- [x] **Database Sync**: `npm run db:push` synced the schema without destroying historical `defaultLocationId` data.

### 3.2 Web Admin Workforce UI
- [x] **Display Fixed**: Navigated to `/workforce`, clicked Edit on an Employee, and the "Default Punch Location" dropdown correctly displayed format `CODE — Name` instead of `()`.
- [x] **New Controls Rendered**: The "Mobile Punch Location Settings" block appears below the master Allocation block.
- [x] **CRUD Operations**: Assigning a location to "Allowed Locations" dynamically POSTs to the new `/api/v1/employees/[id]/allowed-locations` route. Removing clicks DELETE.
- [x] **Policy Flags Save**: Toggling "Require Out-of-Zone Review" issues a PATCH to `/api/v1/employees/[id]/punch-policy`.

### 3.3 Mobile BFF & Geo-Evaluation
- [x] **Location Harvesting**: Calling POST `/api/v1/attendance/check-in` queries the employee and populates all eligible locations for today.
- [x] **Cascade Priority Selection**: If an employee has both an `ON_CALL` assignment and a `DEFAULT_PUNCH`, the system prefers the `ON_CALL` location and calculates radius strictly against it.
- [x] **Radius Override**: If `geofenceRadiusOverrideMeters` is populated on the Employee, it overwrites the individual `AllowedPunchLocation` radius.
- [x] **Out of Bounds Flow**: If `isWithinGeofence` is false, it consults `allowOutOfZonePunch` and sets the `status` to `OUT_OF_ZONE_REVIEW_REQUIRED` (if review required) rather than standard `OUT_OF_ZONE`.

## 4. Conclusion
The implementation resolves the blank dropdown issue and grants full, robust control over employee punching policies directly from the web Admin. The Mobile app correctly inherits and enforces this topology.
