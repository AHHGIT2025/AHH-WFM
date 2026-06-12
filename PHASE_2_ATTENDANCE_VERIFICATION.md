# Phase 2 Attendance Verification

This document verifies the successful implementation of Phase 2 features: **Attendance Validation, Geofencing, Late Arrival Tracking, and Corrections**.

---

## 1. Verified Core Safeguards

### Geofencing Configuration & Doha Seeding
- We successfully defined the `Worksite` database model.
- Seeded the default **Doha Headquarters (West Bay)** worksite at `lat: 25.3186`, `lng: 51.5284` with a `150m` radius.
- Implemented the **Haversine formula** to accurately calculate the distance between the employee's check-in coordinates and all active worksites.
- The system flags checks as `"OUT_OF_ZONE"` instead of blocking them, preserving operative visibility.

### Attendance Double-Action Validation
- **Prevent Concurrency Errors:** When trying to trigger a check-in while an active record is open (check-out is null), the API returns `400 Bad Request` with: `"Employee already has an active check-in session"`.
- **Prevent Out-of-Sequence Errors:** Clock-out requests are blocked if there is no active session.
- **Deactivation Block:** Inactive/deactivated employees are rejected at the check-in gateway.

### Late Arrival Calculation
- Calculates late minutes on check-in by checking the actual clock time against the start time from the snapshot of the employee's assigned `Shift`.
- Exceeding the 5-minute grace period automatically flags the status as `"LATE"` and logs `lateMinutes`.

### Correction Auditing
- Employees submit correction requests via Mobile (`POST /api/v1/attendance/corrections`).
- The system preserves original values: the `AttendanceRecord` retains `originalCheckIn` and `originalCheckOut`, ensuring an immutable audit trail.
- Approved corrections overwrite the effective `checkIn` / `checkOut` timestamps and mark the record status as `"CORRECTED"`, recalculating late minutes dynamically.
- Rejected corrections revert the state back from `"PENDING_CORRECTION"` to their calculated original values (e.g. `ON_TIME` or `LATE`).

---

## 2. API Endpoints Map
- `POST /api/v1/attendance/check-in` — Fully validated geofence and late arrivals check-in.
- `POST /api/v1/attendance/check-out` — Safe clock-out.
- `GET /api/v1/attendance` — Fetch all logs.
- `POST /api/v1/attendance/corrections` — Submit request.
- `PATCH /api/v1/attendance/corrections/[id]` — Review decision (Approved/Rejected) with supervisor notes.
- `GET /api/v1/worksites` — List geofence boundaries.

---

## 3. Web & Mobile UI Changes
- **Mobile Clock-In Panel:** Added a **GPS Location Simulator** selector to let developers easily test "Doha Headquarters (In-Zone)", "Lusail construction site (In-Zone)", or "Remote field (Out-of-zone)" check-ins.
- **Mobile Recent Logs:** Added a "Request Time Correction" button to trigger a datetime modal.
- **Web Admin Monitor:** Displays statuses (`On Time`, `Late`, `Out of Zone`, `Correction Pending`, `Corrected`) with alert badges and shows details for late minutes or geofence violations.
- **Web Correction Approvals:** Renders a list of pending requests with side-by-side time differences, allowing managers to approve or reject with comments.

