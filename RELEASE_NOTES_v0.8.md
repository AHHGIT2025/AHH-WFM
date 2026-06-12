# Release Notes v0.8.0 — Workforce Planning Suite

This release implements the complete Phase 4 Workforce Planning Suite (comprising Phase 4A and 4B) for the AHH WFM system. It introduces Shift Templates, Rotation Patterns, Shift Assignments, real-time conflict checking, Overtime Auto-Calculation, Configurable Rates, Coverage Heatmap analytics, HTML5 Drag-and-Drop scheduling, and Shift Swapping workflows.

## Key Features

### 1. Shift Templates & Rotations (Phase 4A)
- **Shift Templates:** Seeded default templates (Morning, Evening, Night, Split, and Flexible shifts) capturing core hours and Split shift rules.
- **Cyclical Rotation Patterns:** Seeded standard rotation patterns (5x2, 6x1, and 4 On / 4 Off) to generate shift assignments for employee cohorts.
- **Roster Grid Planner:** Comprehensive scheduling board showing timelines, bulk scheduling drawers, and warning badges.
- **Mobile Shifts Portal:** Personal shifts and upcoming schedule lists for field operatives.

### 2. Overtime Auto-Calculation Engine (Phase 4B)
- **Check-out Auto-calc:** Instantly computes overtime at check-out by comparing actual clock-in/out times to the scheduled shift assignments.
- **Multi-category Splitting:** Categorizes excess time into Standard OT, Weekend OT (Friday/Saturday for Qatar), Holiday OT (Holiday table aware), Night OT (defaults to 10 PM - 6 AM), and Special Event OT.
- **Approvals & Auditing:** Logs calculated OT as `PENDING_APPROVAL`. Managers approve or reject records to commit final pay amounts and update approved minutes.

### 3. Coverage Analytics & Heatmaps (Phase 4B)
- **Heatmap Toggle:** Visual overlay on the Web Planner coloring days by staffing levels (Red = Understaffed, Green = Optimized, Yellow = Overstaffed).
- **Required Headcounts:** Configures required staff per shift to identify coverage gaps in real time.

### 4. Interactive Drag-and-Drop Board (Phase 4B)
- **Fluid Scheduling:** Allows managers to drag shift templates between dates and employees.
- **Guarded Safety:** Runs identical real-time conflict checks (overlapping shifts, deactivated employees, approved leaves) before persisting reassignments.

### 5. Shift Swapping Workflow (Phase 4B)
- **Bilateral Requests:** Employees request swaps with colleagues directly from the mobile app.
- **Atomic Operations:** Swaps are applied atomically to both schedules on supervisor approval, preventing double-booking and overlaps.
- **Leave Guarding:** Prevents swaps targeting dates with approved leave.

## REST API Additions
- `GET/POST /api/v1/shifts/templates` — Fetch/create shift templates.
- `GET/POST /api/v1/shifts/assignments` — Fetch/create scheduled assignments.
- `POST /api/v1/shifts/assignments/bulk` — Apply shift templates to multiple employees across a range of dates.
- `POST /api/v1/shifts/assignments/rotations` — Apply cyclic rotations to employee cohorts with conflict checking.
- `GET/POST /api/v1/shifts/rotations` — Fetch/create rotation templates.
- `GET/POST /api/v1/shifts/swaps` — Submit and view bilateral shift swap requests.
- `PUT /api/v1/shifts/swaps/[id]` — Supervisor approval/rejection action on swap requests.
- `GET /api/v1/shifts/coverage` — Aggregate headcount gap metrics.
- `GET/PUT /api/v1/shifts/overtime` — Retrieve/update overtime claim sheets.
- `GET/POST /api/v1/overtime-rates` — Admin rates settings.
- `PATCH /api/v1/overtime-rates/[id]` — Edit multipliers and active triggers.
