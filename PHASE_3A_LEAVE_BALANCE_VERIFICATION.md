# Leave Balances, Accruals, and Holidays Verification (Phase 3A)

This document verifies the successful implementation of Phase 3A of the Leave Management and Calendar integration.

---

## 1. Features Verified

### 1.1 Seeding Data Rules
*   **Leave Types Seeded:** Default leave types were seeded into both MySQL and JSON databases:
    *   **Annual Leave** (`ANNUAL`) - Accruable, carry-forward active.
    *   **Sick Leave** (`SICK`) - Non-accruable, carry-forward disabled.
    *   **Emergency Leave** (`EMERGENCY`) - Non-accruable.
    *   **Unpaid Leave** (`UNPAID`) - Non-accruable.
    *   **Business Travel** (`BUSINESS_TRAVEL`) - Non-accruable.
*   **Holiday Calendar Seeded:** Qatar/Company default holidays loaded:
    *   *Qatar National Sports Day* (Feb 10, 2026)
    *   *Qatar National Day* (Dec 18, 2026)
    *   *Company Eid Al-Fitr Break* (Mar 20, 2026)
    *   *Company Eid Al-Adha Break* (May 27, 2026)

### 1.2 Initial Employee Balances
*   All active employees (`AA-1001`, `SK-90210`, `AM-8821`, etc.) automatically initialized with:
    *   `Annual Leave`: 22.0 days.
    *   `Sick Leave`: 15.0 days.
*   Corresponding `INITIAL` audit ledger entries written to the `LeaveBalanceLedger` table.

### 1.3 Holiday & Weekend Aware Calculations
*   **Weekend Exclusion:** The system excludes Friday and Saturday from leave duration calculations.
*   **Holiday Exclusion:** The system matches dates against the Holiday registry and excludes active holidays from leave duration calculations.
*   *Example:* Submitting a request from Wednesday to Sunday containing a Friday and Saturday weekend will correctly charge only $3$ days.

### 1.4 Web Command Center (Web UI)
*   **Balances Table:** Displays all active employees' Annual and Sick leave remaining balances.
*   **Holiday-Aware Indicator:** Request listings render the computed net working days deduction (e.g. "4 working days (excluding weekends & holidays)") instead of raw calendar durations.
*   **Manual Adjustment Console:** Admin panel to adjust any employee's balance with automated audit logging to the ledger.

### 1.5 Mobile Employee Portal (Mobile UI)
*   **Meters Display:** Displays live calculations for the employee's `Allocated`, `Taken`, `Pending`, and `Remaining` days.
*   **Dynamic Dropdown updates:** Changing selected leave type automatically updates the balance meters.
*   **Date Selectors:** Users select start and end dates using native date input selectors, rendering a live duration cost preview highlighting weekend and holiday deductions before submitting.

---

## 2. API Endpoints Registered & Verified

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **`GET`** | `/api/v1/leave-types` | Returns seeded leave type configurations. |
| **`GET`** | `/api/v1/holidays` | Returns the holiday calendar. |
| **`POST`** | `/api/v1/holidays` | Creates new national/company holidays. |
| **`GET`** | `/api/v1/leave-balances` | Returns leave balances (supports `?employeeId=` query). |
| **`POST`** | `/api/v1/leave-balances` | Applies a manual adjustment with a ledger record, or triggers monthly pro-rata accruals (`action: "accrue"`). |

---

## 3. Manual Testing Logs

### Test Scenario A: Submitting Holiday-Overlapping Request (Mobile UI)
1.  Navigate to mobile leave page.
2.  Select **Annual Leave**. Balance shows: **Allocated 22.0, Remaining 22.0**.
3.  Select dates: **17 Dec 2026** to **21 Dec 2026** (Thursday to Monday).
    *   *Deduction breakdown:*
        *   Calendar span: 5 days.
        *   Excluded weekend: 18 Dec (Friday), 19 Dec (Saturday).
        *   Excluded holiday: 18 Dec (Qatar National Day - also falls on Friday/weekend, so 2 days total excluded).
    *   *Result preview:* **Net Deductible Days: 3 Working Days**.
4.  Submit request.
    *   Request list shows status `Pending Approval`.
    *   Balance meters update: **Pending 3.0, Remaining 19.0**.

### Test Scenario B: Leave Approval & Ledger Entry (Web UI)
1.  Navigate to Web console leave manager page.
2.  Find the pending request.
3.  Click **Approve**.
    *   Status shifts to `Approved`.
    *   Employee status updates to `On Leave`.
    *   Annual Leave balance of the employee updates: **Used 3.0, Pending 0.0, Remaining 19.0**.
    *   Ledger creates entry: type `LEAVE_TAKEN`, delta `-3.0`, reference points to the leave request.

### Test Scenario C: Manual Balance Adjustment (Web UI)
1.  On the Web manual adjustment card:
    *   Select employee: `Sarah Kim`.
    *   Leave Type: `Annual Leave`.
    *   Amount: `5.5` (representing extra overtime credit).
    *   Reason: `Overtime compensation`.
2.  Click **Apply Adjustment**.
    *   Balances table refreshes immediately.
    *   `Sarah Kim`'s Annual Leave balance increments by $+5.5$ days.
    *   Ledger logs type `MANUAL_ADJUSTMENT`, delta `+5.5`.
