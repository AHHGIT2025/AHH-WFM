# Release Notes - v0.14

## Mobile Employee Attendance PWA Foundation

This release introduces the standalone Mobile Progressive Web App (PWA) client for Al Hattab Holding employees, bringing core workforce operations directly to their mobile devices. Built within the existing monorepo, the mobile app leverages a dedicated Backend-for-Frontend (BFF) to optimize performance while safely sharing the centralized WFM database.

### Features Included:

- **Standalone Mobile Login**
  - Isolated authentication flow specifically tailored for mobile operatives, bypassing web admin structures.
- **Mobile BFF API**
  - Secured and optimized endpoints located under `apps/mobile/app/api/v1/`.
- **Employee Dashboard**
  - Quick glance at upcoming assignments, current duty status, and primary action buttons.
- **Punch Screen & Geofence Priority Cascade**
  - Location-aware punch-in and punch-out using a strict server-side resolution cascade (Deployment > On-Call > Shift > Allowed Location > Office).
- **Attendance History**
  - Easily review previous punches, correction statuses, and lateness flags.
- **Schedule**
  - Access personal rosters including upcoming shifts and on-call assignments.
- **Leave Management**
  - Check dynamic leave balances and submit requests right from the phone.
- **Profile**
  - Basic profile details and settings.
- **Supervisor Dashboard**
  - Real-time roll-call counters (Present, Absent, Late, Out of Zone) and a daily roster monitor for mobile management.
- **Web Admin Integration**
  - Full interoperability with the Web console. Punches and requests generated on mobile are instantly visible to Web Admins.

### Technical Notes:
- Theme utilizes the Corporate Integrity palette (Maroon & Gold).
- Next.js builds successfully compile side-by-side without interference.
- Offline synchronization and face recognition capabilities are planned for upcoming phases.
