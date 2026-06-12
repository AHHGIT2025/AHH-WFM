# Attendance Validation, Geofencing, Late Arrival Tracking, and Corrections Design (Phase 2)

This document presents the detailed system design for the Phase 2 implementation of the AHH WFM Attendance Module.

---

## 1. Current AttendanceRecord Schema Review
The existing database schema in `packages/database/prisma/schema.prisma` is:
```prisma
model AttendanceRecord {
  id           String    @id @default(uuid())
  employeeId   String
  employeeName String
  checkIn      DateTime  @default(now())
  checkOut     DateTime?
  lat          Float
  lng          Float
  device       String
  status       String    // "On Time" | "Late" | "Absent" | "Sync Exception"
  locationName String
  employee     Employee  @relation(fields: [employeeId], references: [id], onDelete: Cascade)
}
```
*   **Limitation 1:** Location parameters (`lat`, `lng`, `locationName`) are stored as raw text/numbers of the check-in event, with no foreign key relationship to predefined geofence worksites.
*   **Limitation 2:** No tracking of original values; when checked out or corrected, the fields are directly mutated.
*   **Limitation 3:** Missing tracking fields for assigned shifts, snapshot timestamps, and late arrival minutes.

---

## 2. Current Check-In/Check-Out Endpoint Review
- **`POST /api/v1/attendance/check-in`**: Creates an `AttendanceRecord` directly, sets `status` to `"On Time"`, and updates `employee.status` to `"On Duty"`.
- **`POST /api/v1/attendance/check-out`**: Updates the latest `checkOut` field of the active record and sets `employee.status` to `"Offline"`.
- **Limitation:** Lacks checks for duplicate check-ins, validation of coordinate input structures, and checks for deactivated accounts.

---

## 3. Proposed Worksite Model
To support configurable geofences, we define the `Worksite` model:
```prisma
model Worksite {
  id                String             @id @default(uuid())
  name              String             @unique
  lat               Float
  lng               Float
  radiusMeters      Float              // Allowed distance buffer (e.g. 150m)
  isActive          Boolean            @default(true)
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt
  attendanceRecords AttendanceRecord[]
}
```

---

## 4. Proposed AttendanceRecord Extensions
To support auditing, snapshots, and late minutes, we extend the `AttendanceRecord`:
```prisma
model AttendanceRecord {
  ...
  originalCheckIn    DateTime               @default(now())
  originalCheckOut   DateTime?
  worksiteId         String?
  worksite           Worksite?              @relation(fields: [worksiteId], references: [id], onDelete: SetNull)
  shiftId            String?
  shiftStartSnapshot String?
  shiftEndSnapshot   String?
  lateMinutes        Int                    @default(0)
  corrections        AttendanceCorrection[]
}
```

---

## 5. Proposed AttendanceCorrection Model
Stores requests for adjusting check-in/out logs:
```prisma
model AttendanceCorrection {
  id                 String           @id @default(uuid())
  attendanceRecordId String
  attendanceRecord   AttendanceRecord @relation(fields: [attendanceRecordId], references: [id], onDelete: Cascade)
  requestedCheckIn   DateTime?
  requestedCheckOut  DateTime?
  reason             String           @db.Text
  status             String           // "Pending" | "Approved" | "Rejected"
  reviewedById       String?
  reviewNotes        String?          @db.Text
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt
}
```

---

## 6. Geofence Distance Formula
Distance $d$ in meters between check-in coordinates $(lat_{check}, lng_{check})$ and worksite center $(lat_{site}, lng_{site})$ is computed using the **Haversine formula**:

$$r = 6371000\text{ meters (Earth's radius)}$$
$$\Delta lat = (lat_{check} - lat_{site}) \times \frac{\pi}{180}$$
$$\Delta lng = (lng_{check} - lng_{site}) \times \frac{\pi}{180}$$
$$a = \sin^2\left(\frac{\Delta lat}{2}\right) + \cos\left(lat_{site} \times \frac{\pi}{180}\right) \times \cos\left(lat_{check} \times \frac{\pi}{180}\right) \times \sin^2\left(\frac{\Delta lng}{2}\right)$$
$$c = 2 \times \operatorname{atan2}(\sqrt{a}, \sqrt{1-a})$$
$$d = r \times c$$

If $d > radiusMeters$, the check-in is flagged as `"OUT_OF_ZONE"`.

---

## 7. Late Arrival Calculation Logic
1. Look up the employee's assigned `Shift` parameters.
2. Construct the expected `DateTime` for today's shift start (e.g. `09:00 AM`).
3. Compute the time difference: $\text{Check-in Time} - \text{Expected Start Time}$.
4. If checking in more than 5 minutes late (grace period), log late minutes and assign status `"LATE"`.

---

## 8. Attendance Status State Machine
```
   [Checked Out] ───(Check-In Request)───> [Validate Coords & Active Status]
                                                       │
                                      ┌────────────────┴────────────────┐
                             (In Geofence Zone?)              (Out of Geofence Zone?)
                                      │                                 │
                   ┌──────────────────┴──────────────────┐              ▼
           (Time <= Shift start?)     (Time > Shift start?)     [OUT_OF_ZONE]
                   │                                     │              │
                   ▼                                     ▼              │
               [ON_TIME]                              [LATE]            │
                   │                                     │              │
                   └──────────────────┬──────────────────┘              │
                                      ▼                                 │
                                [Checked In] <──────────────────────────┘
                                      │
                               (Check-Out Request)
                                      │
                                      ▼
                                [Checked Out] ───(Submit Correction)───> [PENDING_CORRECTION]
                                                                                   │
                                                                  ┌────────────────┴────────────────┐
                                                             (Approved?)                       (Rejected?)
                                                                  │                                 │
                                                                  ▼                                 ▼
                                                             [CORRECTED]                     [ON_TIME]/[LATE]
```

---

## 9. Duplicate Check-In/Check-Out Validation Rules
- **Rule 1 (Duplicate Checks):** Reject check-in if there is already an active `AttendanceRecord` where `checkOut` is `null`.
- **Rule 2 (Out of Sequence Check-out):** Reject check-out requests if no open session exists.
- **Rule 3 (Deactivated Employee):** Throw error if employee's `isActive` flag is `false`.
- **Rule 4 (GPS Coordinates Check):** Block check-in if latitude or longitude coordinates are missing, zero (`0,0`), or `NaN`.

---

## 10. Correction Approval Workflow
1. **Request:** Employee submits adjustment values (`requestedCheckIn`/`requestedCheckOut`) and reason.
2. **Locking:** The record's effective `status` is updated to `"PENDING_CORRECTION"`.
3. **Approval:**
    - **Approved:** Overwrites effective `checkIn`/`checkOut` values (leaving `originalCheckIn`/`originalCheckOut` unchanged for audit), recalculates late minutes, and sets status to `"CORRECTED"`.
    - **Rejected:** Reverts the record status back to its original calculation (`ON_TIME` or `LATE`).

---

## 11. API Endpoint Proposal
- `GET /api/v1/worksites` - Retrieve geofence entries.
- `POST /api/v1/worksites` - Add a worksite.
- `PATCH /api/v1/worksites/[id]` - Edit worksite details.
- `POST /api/v1/attendance/corrections` - Submit correction request.
- `PATCH /api/v1/attendance/corrections/[id]` - Approve/reject request.
- `POST /api/v1/attendance/check-in` & `check-out` - Extended validation controllers.

---

## 12. Web UI Impact
- **Attendance Monitor Table:** Render badges (`ON_TIME`, `LATE`, `OUT_OF_ZONE`, `PENDING_CORRECTION`, `CORRECTED`) with indicators for calculated late minutes and original values.
- **Approvals Panel:** Create a tab displaying pending corrections with action items (Approve, Reject) and a comments dialog.

---

## 13. Mobile UI Impact
- **Clock-In Interface:** Present a **GPS Location Simulator** selector to simulate checking in from Doha HQ, Lusail Stadium, or Out of Zone coordinates.
- **Correction Trigger:** Add "Request Time Correction" link to past log items to launch a correction submission modal.

---

## 14. Migration Risks
- **Null Safety:** Backwards compatibility for existing records lacking worksite references and original check-in values.
- **Prisma Generator Lock:** Concurrent processes on Windows locking the prisma client DLL requires running `prisma generate` after halting Next.js development processes.

---

## 15. Testing Checklist
- [ ] Verify check-in blocks deactivated accounts.
- [ ] Verify concurrent check-ins are blocked.
- [ ] Verify coordinates verification triggers (rejects `0,0`).
- [ ] Verify Haversine geofencing tags out-of-zone.
- [ ] Verify shift time calculation logs exact late arrival minutes.
- [ ] Verify correction requests preserve original values and update effective values upon approval.
- [ ] Verify rejection reverts status correctly.
