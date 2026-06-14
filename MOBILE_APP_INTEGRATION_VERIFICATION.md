# MOBILE APP INTEGRATION VERIFICATION

> **Release Checkpoint**: `v0.15-master-data-scheduler-mobile-integration`
## 1. Mobile Screens Implemented
- **Login (`/login`)**: Standalone authentication bypassing the web admin interface.
- **Employee Dashboard (`/`)**: Upcoming shifts, real-time presence indicators, and quick actions.
- **Punch Capture (`/punch`)**: Real-time geolocation coordinates, map mapping, and visual distance validations.
- **Schedule (`/schedule`)**: View upcoming shifts, on-call assignments, and deployments.
- **Leave Management (`/leave`)**: Submit new leave requests, check balances, and view leave history.
- **Attendance History (`/history`)**: Scrollable log of previous punches with lateness flags.
- **Notice Board (`/news`)**: Company announcements and public holidays.
- **Profile (`/profile`)**: Employee details and settings.
- **Supervisor Dashboard (`/supervisor`)**: Special dashboard exclusively for `SUPERVISOR` and `ADMIN` roles.

## 2. BFF Endpoints Implemented
All mobile APIs reside under `apps/mobile/app/api/v1/` to protect Web Admin payloads and optimize mobile responses.
- `GET /api/v1/me`
- `GET /api/v1/dashboard`
- `GET /api/v1/schedule`
- `GET /api/v1/allowed-punch-locations`
- `POST /api/v1/attendance/check-in`
- `POST /api/v1/attendance/check-out`
- `GET /api/v1/attendance/history`
- `GET /api/v1/leaves`, `POST /api/v1/leaves`, `GET /api/v1/leaves/balances`
- `GET /api/v1/announcements`
- `GET /api/v1/supervisor/team-status`

## 3. Login Behavior
- Custom auth configuration scoped for `apps/mobile`.
- Bypasses web admin dashboards and securely authenticates with shared Prisma credentials table.

## 4. Employee Dashboard Behavior
- Aggregates the employee's next shift or active deployment.
- Shows current active status (e.g., Offline, On Duty).
- Restricts punches to authorized locations using Haversine calculation.

## 5. Supervisor Dashboard Behavior
- Groups direct reports and provides live roll-call metrics (Present, Absent, Late, Out of Zone).
- Roster list view showing individual statuses.

## 6. Check-in/Check-out Geofence Priority Cascade
Server-side strict priority enforcement for determining the active worksite coordinates:
1. Active Deployment (`Project/Site`)
2. Active On-Call Assignment
3. Shift Assignment (`Project/Site/OfficeLocation`)
4. Employee Default Punch Location
5. Employee Allowed Punch Locations
6. Office Location
7. Company Policy Fallback

## 7. Shared Database Integration
- `apps/mobile` directly queries `@repo/database` using Prisma Client.
- Leverages the exact same tables as the `apps/web` monorepo application.
- Auto-seeding functions support fallback `.env` scenarios.

## 8. Web/Mobile Synchronization Verification
- Both PWA applications compile and run side-by-side using Next.js without module collisions.
- Check-ins submitted on the Mobile app instantly appear in the Web Admin Attendance Monitor.

## 9. Build Results
- Web Application: `next build` executed successfully.
- Mobile Application: `next build` executed successfully with no TypeScript type errors.

## 10. Web Master Data Hub Integration
All data structures created in the web application (Company, Locations, Projects, Sites, On-Call Assignments, Deployments, Allowed Punch Locations) successfully and seamlessly flow into the Mobile BFF (`/api/v1/allowed-punch-locations`), dynamically determining the prioritized geofence rules.
