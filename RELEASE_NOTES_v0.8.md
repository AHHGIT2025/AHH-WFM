# Release Notes v0.8.0 — Shift Templates, Rotations & Scheduling Board

This release implements Phase 4A of the AHH WFM Scheduling & Rotations system, introducing Shift Templates, Rotation Patterns, Shift Assignments, a basic scheduling grid, bulk planning tools, and real-time conflict checking.

## Key Features

### 1. Shift Template Management
- Seeded default templates: Morning, Evening, Night, Split, and Flexible shifts.
- Implemented configurations including start/end times, split shifts, flexible core hours, and activation flags.

### 2. Cyclical Rotation Patterns
- Seeded standard rotation patterns: 5x2, 6x1, and 4 On / 4 Off.
- Implemented pattern-based bulk assignment that translates cyclic schedules onto calendar calendars for employee cohorts.

### 3. Real-Time Conflict Detection Engine
- Checks scheduling constraints during assignments and blocks/warns of rules violations:
  - **Inactive Employees**: Blocks assignments to deactivated members.
  - **Overlapping Shifts**: Flags overlapping templates assigned on the same date.
  - **Approved Leaves**: Highlights conflicts if a shift overlaps an approved leave period.
- Ensures rotation schedulers report conflicts instead of silently overwriting existing rosters.

### 4. Consolidated Web Planner Grid
- Renders scheduling board console displaying employee timelines, active assignments, and details.
- Integrated bulk scheduler drawer and rotation template applicator panel.
- Shows warning conflict badges on the grid interface to alert schedulers.

### 5. Mobile Shifts Screen
- Added `/shifts` page displaying the authenticated employee's My Shifts and Upcoming Shifts.
- Displays full start/end times, template names, and notes.

## API Additions
- `GET/POST /api/v1/shifts/templates` — Fetch/create shift templates.
- `GET/POST /api/v1/shifts/assignments` — Fetch/create scheduled assignments.
- `POST /api/v1/shifts/assignments/bulk` — Apply shift templates to multiple employees across a range of dates.
- `POST /api/v1/shifts/assignments/rotations` — Apply cyclic rotation templates to employee groups with conflict checking.
- `GET/POST /api/v1/shifts/rotations` — Fetch/create rotation templates.
