# Phase 4 Design: Scheduling, Rotations, & Overtime Engine

This document details the architectural design and database models for Phase 4 (Scheduling & Resource Optimization) of the AHH WFM application suite.

---

## 1. Shift Templates
To manage diverse workforce schedules, the shift system will define templates with specific core patterns:

- **Morning Shift:** Standard daytime shift (e.g., 06:00 - 14:00).
- **Evening Shift:** Second operational shift (e.g., 14:00 - 22:00).
- **Night Shift:** Overnight shift (e.g., 22:00 - 06:00 next day).
- **Split Shift:** Shift broken into multiple blocks (e.g., 08:00 - 12:00 and 16:00 - 20:00).
- **Flexible Shift:** Core hours requirement (e.g., 8 hours required within a 24-hour window, no rigid start/end).

---

## 2. Rotation Templates
Rotations automate recurring patterns over cycles:
- **5x2 Pattern:** 5 days on duty, 2 consecutive days off.
- **6x1 Pattern:** 6 days on duty, 1 day off (common in logistics and site operations).
- **4 On / 4 Off Pattern:** 4 consecutive days on duty, 4 consecutive days off.
- **Custom Rotations:** Custom N-day cycles containing designated shift templates and rest days.

---

## 3. Workforce Planner
The workforce planner provides grid-based dashboards scoped by organizational levels:
- **Monthly Planner:** 30-day view for high-level resource tracking.
- **Weekly Planner:** 7-day operational view showcasing specific daily coverage.
- **Department Planner:** Filtered roster for specific department supervisors.
- **Team Planner:** Scoped layout showing specific operational teams or sites.

---

## 4. Shift Assignment Engine
Engine algorithms to allocate shifts:
- **Single Employee Assignment:** Direct slot allocation.
- **Bulk Assignment:** Allocating a shift template to multiple employees on specific dates.
- **Rotation Assignment:** Applying a rotation template starting from an anchor date, automatically calculating and writing assignments forward.

---

## 5. Conflict Detection Engine
Automatic real-time safety validations before assigning shifts or clocking in:
- **Leave Conflicts:** Blocks shift scheduling if the employee has approved leave on that date.
- **Attendance Conflicts:** Detects disparities between actual clock-ins and scheduled shifts.
- **Overlapping Shifts:** Restricts assigning multiple shifts on the same day that overlap in hours.
- **Overtime Conflicts:** Warnings when scheduled shifts exceed daily or weekly threshold parameters.

---

## 6. Overtime (OT) Engine
Compiles actual check-in data against scheduled shift definitions:
- **Standard OT:** Extra hours worked outside the scheduled shift hours on normal business days.
- **Weekend OT:** Hours worked on designated weekends (e.g., Friday/Saturday in Qatar).
- **Holiday OT:** Hours worked on registered holidays (mapped to the Holiday calendar database).

---

## 7. Coverage Analysis
Live analytics dashboards displaying operational readiness:
- **Required Headcount:** Target manpower required per worksite/department per hour.
- **Scheduled Headcount:** Total personnel allocated.
- **Coverage Gap:** Visual heatmaps showing under-staffing (gap < 0) or over-staffing (gap > 0).

---

## 8. Mobile Experience (Operative)
- **My Shifts:** Display of current active shifts.
- **Upcoming Shifts:** Roster of future assignments.
- **Calendar View:** Month-grid visualization highlighting shifts, holidays, and leaves.
- **Shift Swap Requests:** Mobile workflow for requesting swaps with peers, routing to supervisors for approval.

---

## 9. Web Experience (Supervisor / HR)
- **Planner Board:** Gantt-style calendar displaying all employees.
- **Drag-and-drop Scheduler:** Interactive mouse controls to move or copy shift blocks between workers and dates.
- **Coverage Dashboard:** Analytical widgets showing real-time attendance compared to scheduled roster targets.

---

## 10. Database Schema Proposal

```prisma
model ShiftTemplate {
  id          String      @id @default(uuid())
  name        String      // Morning, Night, Split etc.
  startTime   String      // "08:00"
  endTime     String      // "17:00"
  isSplit     Boolean     @default(false)
  splitStart  String?     // "16:00" if isSplit
  splitEnd    String?     // "20:00" if isSplit
  isFlexible  Boolean     @default(false)
  coreHours   Float?      // 8.0 hours
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  assignments ShiftAssignment[]
}

model RotationTemplate {
  id          String      @id @default(uuid())
  name        String      // "5x2 Pattern", "4 On 4 Off"
  cycleDays   Int         // Total days in rotation cycle
  patternJson String      @db.Text // JSON list of shiftTemplateIds or rest days
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}

model ShiftAssignment {
  id              String         @id @default(uuid())
  employeeId      String
  employee        Employee       @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  shiftTemplateId String
  shiftTemplate   ShiftTemplate  @relation(fields: [shiftTemplateId], references: [id])
  date            DateTime       // Date of scheduled shift
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@unique([employeeId, date])
}

model ShiftSwapRequest {
  id                String          @id @default(uuid())
  requestorId       String
  targetEmployeeId  String
  requestorShiftId  String
  targetShiftId     String
  status            String          // "PENDING", "APPROVED", "REJECTED"
  reason            String?
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
}
```

---

## 11. REST API Proposal

### Shift Templates
- `GET /api/v1/shifts/templates` — List all shift templates.
- `POST /api/v1/shifts/templates` — Create a shift template.

### Assignments
- `GET /api/v1/shifts/assignments` — Query shift schedule assignments.
- `POST /api/v1/shifts/assignments` — Create single or bulk shift assignments.
- `POST /api/v1/shifts/assignments/rotations` — Apply rotation template to employees.

### Swap Requests
- `GET /api/v1/shifts/swaps` — Get pending shift swap requests.
- `POST /api/v1/shifts/swaps` — Initiate a swap request.
- `PUT /api/v1/shifts/swaps/:id` — Action (Approve/Reject) a swap request.

---

## 12. Testing & Verification Strategy

### Automated Tests
- Unit testing conflict calculations (Leave overlaps, overlapping shift hours).
- Verification checks for the Haversine coordinates radius and grace-period late calculations.

### Manual Verification
- Testing bulk scheduling grid updates.
- Performing drag-and-drop calendar moves.
- Validating mobile Shift Swap request lifecycles.
