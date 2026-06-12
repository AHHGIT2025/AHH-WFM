# Release Notes: v0.5-attendance-geofencing-complete

We are pleased to announce the completion of **Phase 2 (Milestone 4)** of the **AHH WFM** (Workforce Management) application suite. This release implements robust attendance validation rules, multi-worksite geofencing checks, automatic late tracking, a comprehensive supervisor approval workflow for attendance corrections, and testing enhancements including a Mobile GPS simulator.

---

## What's New in v0.5

### 1. Worksite & Geofencing Model
*   **Dynamic Worksite Configuration:** Added the `Worksite` database model to store multiple physical locations with configurable name, latitude, longitude, and radius (in meters).
*   **Haversine Distance Validation:** Check-in API coordinates are compared to the nearest worksite using the Haversine formula.
*   **Out-of-Zone Flagging:** Employees checking in outside the permitted radius of any active worksite are marked with an `OUT_OF_ZONE` status instead of being blocked, allowing management oversight without locking operatives out of the system.
*   **Seeded Worksites:** Automatic seeding script includes default Doha worksites (e.g., Doha Headquarters and Lusail Site).

### 2. Guardrails & Attendance Validation
*   **Action Prevention Checks:**
    *   **Double Check-in Prevention:** Restricts employees from checking in again if they already have an active open attendance session.
    *   **Orphan Check-out Prevention:** Restricts employees from checking out unless they have an active open check-in.
    *   **Inactive Employee Protection:** Prevents deactivated employees (`isActive = false`) from clocking in or out.
    *   **Coordinate Integrity:** Validates that incoming coordinate inputs are present and formatted correctly.

### 3. Late Arrival Tracking
*   **Shift Snapshots:** The scheduled shift start and end times are saved directly onto the `AttendanceRecord` at check-in, protecting the record's historical accuracy if shift rules change later.
*   **Lateness Calculation:** Compares actual check-in timestamps against shift start hours, applying a **5-minute grace period**. Check-ins beyond the grace period calculate late minutes and set the record status to `LATE`.

### 4. Attendance Correction Request Workflow
*   **Audit-Safe Modifications:** Employees can request clock-in/out corrections from their mobile attendance history log. The record preserves the original timestamps (`originalCheckIn` / `originalCheckOut`) for compliance auditing.
*   **Supervisor Command Center:** An approvals panel displays all pending corrections in a web dashboard, enabling supervisors to review, approve, or reject requests. Approved corrections update the effective clock times and update the status to `CORRECTED`.

### 5. Developer & Testing Tools
*   **Mobile GPS Simulator:** Integrated a custom dropdown simulator in the mobile header, permitting developers to spoof device coordinates between *Doha HQ* (within zone), *Lusail Site* (within zone), and *Out of Zone* configurations to test geofencing responses in real-time.

---

## Getting Started & Verification

### Local Setup
Ensure you have updated your local packages and generated the latest Prisma client:
```bash
npm install
npm run db:generate
```

### Database Migration
Apply the new schema changes (Worksite, AttendanceRecord extensions, and AttendanceCorrection tables) to your MySQL instance:
```bash
npm run db:push
```
If running in JSON fallback mode, the schema upgrades are applied dynamically to your local `db.json` database.

### Running Applications
```bash
# Web Command Center (localhost:3100)
npm run dev:web

# Mobile Employee Portal (localhost:3101)
npm run dev:mobile
```
