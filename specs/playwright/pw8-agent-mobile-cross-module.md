# PW-8 Mobile / Cross-Module Full Playwright Certification

## 1. Executive Summary & Strategy
Comprehensive cross-module end-to-end browser test plan certifying the unified operational mobile experience across all AHH WFM business boundaries: Current Duty resolution, Roster Deployment, Geofenced Attendance, Leave Lifecycles, Universal Approval Center, SECFAC Operations, Supervisor Dashboard, and Offline Sync.

## 2. Platform Architecture
- **Mobile-Chrome (Pixel 5 Viewport: 393x851)**: Authoritative frontline employee, guard, supervisor, and mobile approver journeys.
- **Desktop Chromium (1280x720)**: Desktop cross-module validation and state-changing synchronization verification.

## 3. Targeted User Journeys

### Scenario 1: Identity & Current Duty Resolution
- **Platform**: Mobile-Chrome
- **Target Route**: `/` (Mobile Dashboard)
- **Role**: Authorized Employee / Blue Collar / Guard
- **Verification**: Welcome card renders employee designation, verified identity key, active assignment status, and duty location badge without stale cache.

### Scenario 2: Roster & Published Schedule Visibility
- **Platform**: Mobile-Chrome
- **Target Routes**: `/schedule`, `/shifts`
- **Role**: Employee / Guard
- **Verification**: Today's shift timing, assigned roster slots, shift template rules, and calendar breakdown.

### Scenario 3: Geofenced Attendance Punch & History
- **Platform**: Mobile-Chrome
- **Target Routes**: `/punch`, `/history`
- **Role**: Employee / Guard
- **Verification**: Geofence proximity calculation, punch button state transition (Check In -> Check Out), attendance log record generation.

### Scenario 4: Leave Request Lifecycle & Availability Impact
- **Platform**: Mobile-Chrome
- **Target Route**: `/leave`
- **Role**: Employee
- **Verification**: Leave type selector, date range, submission confirmation, balance indication.

### Scenario 5: Mobile Universal Approval Center — Pending Inbox & Filters
- **Platform**: Mobile-Chrome
- **Target Route**: `/approvals` (Inbox tab)
- **Role**: Approver / Supervisor / Admin
- **Verification**: Tab switching (Inbox/Outbox), module filter chips (Commercial, Clearance, Leave, Manpower, SECFAC), search query bar, item cards with reference badges.

### Scenario 6: Mobile Universal Approval Center — Detail View & Lifecycle Actions
- **Platform**: Mobile-Chrome
- **Target Route**: `/approvals/[id]`
- **Role**: Approver / Admin
- **Verification**: Business summary card, timeline steps, prior actor remarks, interactive decision panel (Approve, Return, Reject) with remarks validation and deep link to Web source.

### Scenario 7: Mobile Universal Approval Center — Actioned Outbox Tracking
- **Platform**: Mobile-Chrome
- **Target Route**: `/approvals` (Outbox tab)
- **Role**: Approver / Admin
- **Verification**: Preserves live record of actioned workflows, shows actor action timestamp, and reflects subsequent stage progression.

### Scenario 8: SECFAC Guard Tour & Duty Post Orders Context
- **Platform**: Mobile-Chrome
- **Target Routes**: `/guard-tour`, `/secfac-post-orders`
- **Role**: Security Guard / Supervisor
- **Verification**: Post order version tags, digital acknowledgement button, site-specific instructions matching active deployment.

### Scenario 9: SECFAC Incident Occurrence Reporting & Audit Trail
- **Platform**: Mobile-Chrome
- **Target Route**: `/incident-report`
- **Role**: Security Guard / Field Officer
- **Verification**: Pre-populated site context, severity selection, idempotent reference code (`INC-YYYYMM-XXXX`), immediate Web Control Room synchronization.

### Scenario 10: SECFAC Shift Briefing & Safety Instructions
- **Platform**: Mobile-Chrome
- **Target Route**: `/secfac-briefing`
- **Role**: Supervisor / Guard
- **Verification**: Shift briefing logs, temporary instructions, known risk logs.

### Scenario 11: SECFAC Supervisor Field Inspection Journey
- **Platform**: Mobile-Chrome
- **Target Route**: `/secfac-supervisor-inspection`
- **Role**: Supervisor / Admin
- **Verification**: Turnout compliance evaluation, guard employee ID context, corrective action log.

### Scenario 12: Patrol Checkpoint Assurance & Sequence Deviation Block
- **Platform**: Mobile-Chrome
- **Target Route**: `/secfac-patrol`
- **Role**: Security Guard
- **Verification**: Mandatory sequence route validation, out-of-order scan simulation triggers high-contrast deviation alert.

### Scenario 13: Emergency Dispatch Console & Live GPS Arrival
- **Platform**: Mobile-Chrome
- **Target Route**: `/secfac-dispatch`
- **Role**: Emergency Responder
- **Verification**: Dispatched emergency cards, status update actions.

### Scenario 14: Lone Worker Welfare Checks & Offline Storage Queue
- **Platform**: Mobile-Chrome
- **Target Routes**: `/secfac-welfare`, `/sync-status`
- **Role**: Lone Guard / Field Officer
- **Verification**: Check-in timer acknowledgment, offline mode toggle, local storage queue count reflection.

### Scenario 15: Supervisor Team Attendance Dashboard
- **Platform**: Mobile-Chrome
- **Target Route**: `/supervisor`
- **Role**: Supervisor / Admin
- **Verification**: Team roster cards, real-time presence indicators, punch correction approvals.

### Scenario 16: Mobile Command Suite & Executive Escalation
- **Platform**: Mobile-Chrome
- **Target Route**: `/command-center`
- **Role**: Authorized Commercial / Operations Manager
- **Verification**: Wallboard KPIs, commercial health indicators, roster coverage metrics.

### Scenario 17: Cross-Module Data Consistency (Web <-> Mobile)
- **Platform**: Desktop Chromium & Mobile-Chrome
- **Verification**: Roster assignment created on Web reflects in Mobile Current Duty; Mobile incident appears in Web Control Room; Approval action on Mobile updates Web Approval Center.

### Scenario 18: Security, Tenant Isolation & RBAC Boundaries
- **Platform**: Mobile-Chrome & Chromium
- **Verification**: Unauthorized deep links blocked; cross-company data access rejected with 403; operationType boundaries enforced.
