# Mobile App Implementation Plan

## Objective
Build the Al Hattab Holding Employee Attendance mobile app as a Next.js PWA within `apps/mobile`. It will leverage the existing monorepo backend, `next-auth`, and Prisma schema, providing specialized mobile screens for Blue-Collar, White-Collar, and Supervisor personas.

## Design Aesthetic
- **Brand Colors**: Deep Maroon (`#800040`) and Gold accent (`#b89d7e`).
- **Theme**: Clean light surface.
- **Typography**: Inter font.
- **Vibe**: Corporate Integrity, using "Endless Confidence" where appropriate, native-feel.

## Mobile Screens to Build (`apps/mobile/app/...`)

1. **`/login`**: Clean, standalone mobile login screen with employee role detection.
2. **`/` (Dashboard)**: Role-aware hub displaying duty status, current assignment (office/project/on-call), and quick-glance widgets.
3. **`/punch`**: GPS capture page enforcing the priority validation cascade (Deployment > On-Call > Shift > Allowed Location > Office). Includes placeholders for Face Recognition (UI only) and Offline Sync.
4. **`/schedule`**: Calendar/list view of upcoming deployments, shifts, and leaves.
5. **`/leave`**: Leave balances, request form, and history.
6. **`/history`**: Historical attendance logs, overtime, and exceptions.
7. **`/announcements`**: Company and site-level notices.
8. **`/profile`**: Employee details and configurations.
9. **`/supervisor`**: (Role-gated) Team roster, present/absent counts, exception flagging, and a bulk-scanner placeholder.

## Mobile BFF APIs (`apps/mobile/app/api/v1/...`)
To minimize client payload and ensure security, we will build a dedicated Mobile Backend-for-Frontend (BFF) inside the `apps/mobile` project rather than polluting the `web` admin APIs.

**Proposed Endpoints:**
- `GET /api/v1/me`: Hydrates user session, role, and permissions.
- `GET /api/v1/dashboard`: Aggregates today's assignment, active punch status, and immediate announcements.
- `GET /api/v1/schedule`: Pulls upcoming shifts, leaves, and deployments.
- `GET /api/v1/allowed-punch-locations`: Fetches dynamic geofences for the user.
- `POST /api/v1/attendance/check-in`: GPS validation + DB insertion.
- `POST /api/v1/attendance/check-out`: Checkout finalization.
- `GET /api/v1/attendance/history`: Paginated logs.
- `GET /api/v1/leaves/balances` & `POST /api/v1/leaves`: Leave management.
- `GET /api/v1/announcements`: Global/Project notices.
- `GET /api/v1/supervisor/team-status`: Aggregated team metrics.

## Shared Packages Affected
- `packages/database`: Will be heavily utilized; current schema fields fully support the requirements. No migrations expected.
- `packages/ui`: Will share utility components (Buttons, Inputs), adapted with mobile Tailwind classes.

## Integration Points with Web
- Both apps share the exact same MySQL database.
- Web Admin (`apps/web`) will immediately see punches recorded from `apps/mobile`.
- The Mobile app relies on the configurations (Projects, Geofences, Policies) set in the Web Admin Master Data Hub.

## Risks & Mitigations
1. **GPS Accuracy**: Web Geolocation API varies by device. Mitigation: Implement a generous default radius and clear UI loading states for location acquisition.
2. **Session Security**: Ensuring Admin APIs aren't exposed. Mitigation: The mobile BFF strictly enforces employee/supervisor bounds and filters by `employeeId`.

## Testing Plan
1. Validate role-routing post-login (Blue Collar vs White Collar vs Supervisor).
2. Validate the Geofence Priority Cascade by simulating GPS coordinates.
3. Ensure side-by-side execution (`npm run dev --workspace=apps/mobile` & `web`) functions without port collisions.
