# Release Notes: v0.6-leave-balance-engine-complete

We are pleased to announce the completion of **Phase 3A** of the **AHH WFM** (Workforce Management) application suite. This release implements the core dynamic Leave Balance calculation engine, Holiday Calendar registries with weekend-aware duration deduction, and manual balance adjustment workflows with audit logs.

---

## What's New in v0.6

### 1. Leave & Balance Database Models
*   **LeaveType Configurations:** Added the `LeaveType` database schema tracking settings for Annual, Sick, Emergency, Unpaid, and Business Travel categories.
*   **Dynamic Balances:** Created the `LeaveBalance` table to track allocated, used, and pending days per employee.
*   **Audit Ledgers:** Introduced the `LeaveBalanceLedger` model logging INITIAL, ACCRUAL, MANUAL_ADJUSTMENT, and LEAVE_TAKEN logs to ensure complete financial and operational auditing.

### 2. Holiday Calendar Registry & Calculations
*   **Qatar and Corporate Holidays:** Seeded default Qatar national holidays (National Day, National Sports Day) and Company holiday break examples.
*   **Weekend and Holiday Exclusion:** The leave duration engine has been upgraded to exclude weekends (Friday and Saturday in Qatar) and registered holidays from the deductible days count when calculating leave requests.

### 3. Balance Adjustments & Accruals
*   **Pro-rata Monthly Accruals:** Supported pro-rata monthly calculations (e.g. $+1.83$ days/month) writing automated audit logs to the ledger.
*   **Supervisor Adjustment Panel:** Admins can adjust allotments via a manual adjustment form inside the Web Console, prompting for reasons and writing ledger logs instantly.

### 4. Interface Updates
*   **Mobile Requisitions:** Upgraded date range inputs to start/end date selectors. Features a real-time deduction cost preview showing weekend and holiday exclusions before users submit. Progress meters now update dynamically based on the selected leave type.
*   **Web Console Command Center:** Implemented an interactive Employee Leave Balances Summary board listing current allotments, manual balance adjustment cards, and weekend/holiday-aware calculations in pending request queues.

---

## Getting Started & Verification

### Local Setup
Ensure you have updated your local packages and synchronized your databases:
```bash
npm install
cmd.exe /c "npm run db:push"
```

### Build & Run
```bash
# Web console (localhost:3100) and Mobile client (localhost:3101)
npm run build
npm run dev
```
