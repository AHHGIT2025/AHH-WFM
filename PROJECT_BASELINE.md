# AHH WFM - Project Baseline Status

This document defines the baseline status of the **AHH WFM** monorepo application as of the initial foundation completion (v0.1).

---

## 1. Feature Inventory

### Web Admin Command Center (`apps/web`)
*   **Real-time Overview Dashboard:** Displays system sync latency, active field operative counts, pending leave counters, and a topographic Doha regional map with interactive, glowing worker location pins.
*   **Operatives Cluster Meter:** Visual indicators showing staff distribution percentages across Doha HQ, West Bay, and Lusail.
*   **Workforce Directory:** Complete list of system employees with department filters, roles, active duties, and SuccessFactors manual sync triggers.
*   **Attendance Auditor:** Geo-attendance ledger showing clock-in coordinates, resolved location names, device configuration parameters, and check-in times.
*   **Leave Requisition Manager:** Approval deck displaying leave durations, applicant comments, and check/cross buttons to approve or reject requests.
*   **SAP ERP Sync Hub:** Status panels detailing OData API integrations, multi-node latencies, mapping status graphs, and transactional sync log ledgers.
*   **SuccessFactors Schema Mapper:** Visual rules table mapping ERP fields to local DB schemas.
*   **Shift Master & Scheduler:** Form to register shift durations and rotation rules.

### Mobile Employee App (`apps/mobile`)
*   **Mobile Simulator View:** High-fidelity smartphone mockup view.
*   **Check-In Panel:** Current date/time display, GPS-resolved location status banner, and check-in/out toggles.
*   **Attendance History:** Log of past clock-in durations.
*   **Leave Requests:** Submission forms (type selection, date range, comments) and leave balances tracker.
*   **Announcements Feed:** Noticeboard displaying urgent alerts and system upgrades.
*   **Profile Center:** Credentials, active certifications, and shift allocations.

---

## 2. Known Gaps & Technical Debt

*   **Security & Authentication:** The applications run without active auth layers. User directories and API endpoints lack route guards (e.g. NextAuth.js).
*   **GPS Mock Coordinates:** Geofences and geolocations are simulated inside code hooks rather than fetching live browser Geolocation API coordinates.
*   **Direct ERP Connections:** The SAP SuccessFactors mapping dashboard operates on local database schemas. Real SuccessFactors OData endpoints are represented by simulated sync delays and log triggers.
*   **Data Validation:** Basic form validations are in place, but deep sanitization and constraints (e.g., date conflicts in leave requests) are not enforced at the database level.
*   **Automated Tests:** Unit and end-to-end integration tests (using Jest or Playwright) are not yet implemented.

---

## 3. Recommended Next Milestones

### Milestone 2: Authentication & Role-Based Access Control (RBAC)
*   **Deliverables:**
    *   Integrate NextAuth.js (Auth0 or credentials provider).
    *   Implement user login screen on Web and Mobile client portals.
    *   Restrict dashboard routing based on employee status (Operator vs. Supervisor).

### Milestone 3: Real Geolocation & Mobile Integration
*   **Deliverables:**
    *   Replace simulated coordinates with the HTML5 Geolocation API (`navigator.geolocation`).
    *   Implement warning alerts if check-in coordinates fall outside defined geofence boundary radiuses.
    *   Optimize mobile shell layouts for native device wrappers (e.g., Capacitor).

### Milestone 4: SAP SuccessFactors Integration Bridge
*   **Deliverables:**
    *   Configure live client HTTP hooks using the SuccessFactors OData API.
    *   Implement automatic synchronization cron jobs to push local attendance records to SAP.
    *   Connect the Mapping Dashboard rules engine to dynamically construct payload formats.
