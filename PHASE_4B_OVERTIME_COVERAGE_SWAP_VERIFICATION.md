# Phase 4B Verification — Overtime, Coverage Heatmaps, Shift Swaps & Drag-and-Drop Scheduler

This document verifies the successful implementation of the Phase 4B features of the AHH WFM Scheduling & Rotations engine.

---

## 1. Shift Swap Workflows

### Verification Checklist & Results

| Case ID | Scenario | Expected Outcome | Status |
|---|---|---|---|
| **SWAP-01** | Create swap request between active employees on valid dates | ShiftSwapRequest is logged in PENDING status. Visible on both Web Console and Mobile. | **PASSED** |
| **SWAP-02** | Swap request involving an inactive employee | Blocked. Validation returns a `400` error describing the violation. | **PASSED** |
| **SWAP-03** | Swap request on dates overlapping approved leaves | Blocked. Validation returns an error specifying the leave date conflict. | **PASSED** |
| **SWAP-04** | Supervisor approves swap request | Assignments are swapped atomically between the two employees. Roster updates in real-time. | **PASSED** |
| **SWAP-05** | Supervisor rejects swap request | Status changes to REJECTED. Original assignments remain unaltered. | **PASSED** |

---

## 2. Overtime Auto-Calculation Engine

Overtime is computed dynamically at check-out by matching actual clock durations against scheduled template hours. Excess minutes are classified, multipliers applied, and estimated payouts calculated immediately.

### Overtime Types & Rates Calculations

* **Base Rate**: `50.0 QAR / hour` (default).
* **STANDARD_OT**: Work on normal business days exceeding scheduled template hours. Rate: `1.25x` (Estimated pay: `mins / 60 * 50 * 1.25`).
* **WEEKEND_OT**: Overtime minutes worked on Friday and Saturday (Qatar weekend rules). Rate: `1.5x`.
* **HOLIDAY_OT**: Overtime minutes worked on registered Holiday calendar dates. Rate: `2.0x`.
* **NIGHT_OT**: Overtime minutes worked within the Night window (10:00 PM - 06:00 AM). Rate: `1.25x`.

### Verification Results

* **Checkout computation**: Standard, weekend, holiday, and night overtime values are split correctly into separate properties on the `AttendanceRecord`.
* **PENDING_APPROVAL state**: Calculated overtime is saved in the record with `otStatus = "PENDING"`.
* **Manager Review**: Supervisors can approve or reject. On approval, `otApprovedMinutes` is set and the payout is committed. On rejection, `otApprovedMinutes` is set to 0.
* **Guarding**: Prevents double approvals or approving incomplete sessions (missing checkout).

---

## 3. UI Features

### Web Gantt Planner
* **Coverage Heatmap Toggle**: Overlaying heatmap headers colors cells according to target numbers (Red = Understaffed, Green = Optimized, Yellow = Overstaffed).
* **HTML5 Drag-and-Drop**: Rescheduling shifts by dragging scheduled templates across the board. Runs conflict checks (leaves, overlaps, inactive) before completing the reassignment.
* **Overtime Rates settings**: Administrative settings page displaying multipliers, allowing creating/modifying rules in QAR currency.

### Mobile App
* **Roster Calendar**: Integrates assigned shifts, approved leave durations, and holidays.
* **Shift Swap Wizard**: Peer lookup selector allowing submitting swap requests.
* **Overtime Dashboard**: Displays calculated overtime hours, approval status, and payout amount after sign-off.
