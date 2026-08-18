# PW-7 SECFAC / Security Guarding Full Playwright Certification

## 1. Executive Summary & Test Strategy
Comprehensive end-to-end browser test plan covering all operational capabilities of the SECFAC (Security Guarding & Facility Management) module across Desktop Web (Chromium) and Mobile-Chrome (Pixel 5).

## 2. Test Architecture & Projects
- **Desktop Chromium**: Full operational suites for Web Command Center, Post Orders, Shift Briefings, Incidents, Supervisor Inspections, Patrol Routes, Checkpoints, SOS Alerts, Welfare Checks, Checklist Builder, Audit Trail, and Workflow Integration.
- **Mobile-Chrome**: Full operational suites for Mobile Dashboard, Guard Tour Hub, Duty Post Orders, Report Incident, Shift Briefing, Supervisor Field Inspection, Patrol Checkpoint Execution, Responder Emergency Dispatch, and Lone Worker Welfare.

## 3. Detailed Browser User Journeys

### Scenario 1: SECFAC Command Center & Navigation Grid
- **Platform**: Web (Desktop Chrome)
- **Target Route**: `/secfac`
- **Role**: `ADMIN` / `SECURITY_ADMIN`
- **Verification**: Command Center header, 11 operational module cards, open module navigation links, placeholder banner.

### Scenario 2: Digital Post Orders Lifecycle & Version Lineage
- **Platform**: Web & Mobile
- **Target Routes**: `/secfac/post-orders` (Web) & `/secfac-post-orders` (Mobile)
- **Role**: `ADMIN` (Creation & Review) / `SECURITY_GUARD` (Duty Acknowledgement)
- **Verification**: Site selection, post order display, version tags, digital acknowledgement button, status transition from PENDING ACK to ACKNOWLEDGED.

### Scenario 3: Shift Briefings & Pre-Shift Safety Logs
- **Platform**: Web & Mobile
- **Target Routes**: `/secfac/shift-briefings` (Web) & `/secfac-briefing` (Mobile)
- **Role**: `ADMIN` / `SUPERVISOR` / `GUARD`
- **Verification**: Briefing history, date, stage, safety notes, known risks, temporary instructions.

### Scenario 4: Field Incident & Occurrence Reporting & Lifecycle
- **Platform**: Web & Mobile
- **Target Routes**: `/secfac/incidents` (Web) & `/incident-report` (Mobile)
- **Role**: `GUARD` / `SUPERVISOR` / `ADMIN`
- **Verification**: Incident form validation (Site, Record Type, Severity, Category, Title, Description, Immediate Action), submission, generated incident reference (e.g. `INC-YYYYMM-XXXX`), Web incident drawer, status transitions.

### Scenario 5: Supervisor Field Inspections & Turnout Audit
- **Platform**: Web & Mobile
- **Target Routes**: `/secfac/supervisor-inspections` (Web) & `/secfac-supervisor-inspection` (Mobile)
- **Role**: `SUPERVISOR` / `ADMIN`
- **Verification**: Inspection form (Site ID, Guard ID, Overall Result COMPLIANT/NON_COMPLIANT, Notes, Corrective Action), submission, Web inspection table review and findings.

### Scenario 6: Patrol Routes, Checkpoints & Assurance Execution
- **Platform**: Web & Mobile
- **Target Routes**: `/secfac/patrol-routes`, `/secfac/checkpoints` (Web) & `/secfac-patrol` (Mobile)
- **Role**: `ADMIN` / `GUARD`
- **Verification**: Registered NFC checkpoints, route definition, sequence mode (MANDATORY/ADVISORY), mobile out-of-order sequence deviation blocking.

### Scenario 7: Control Room & Responder Emergency Dispatch
- **Platform**: Web & Mobile
- **Target Routes**: `/secfac/control-room` (Web) & `/secfac-dispatch` (Mobile)
- **Role**: `DISPATCHER` / `RESPONDER` / `ADMIN`
- **Verification**: Live dispatch events, Accept / Reject action, Mark Arrived with GPS accuracy, Complete Dispatch with resolution findings.

### Scenario 8: SOS Emergency Alerts Center & Acknowledgment
- **Platform**: Web
- **Target Route**: `/secfac/sos-alerts`
- **Role**: `ADMIN` / `SECURITY_ADMIN`
- **Verification**: Emergency panic alarms, severity, site context, acknowledge and escalation lifecycle.

### Scenario 9: Lone Worker Welfare Checks & Acknowledgment
- **Platform**: Web & Mobile
- **Target Routes**: `/secfac/welfare-checks` (Web) & `/secfac-welfare` (Mobile)
- **Role**: `GUARD` / `ADMIN`
- **Verification**: Scheduled welfare checks, due time, grace period, "I'M SAFE — CHECK IN" response, offline status prompt handling.

### Scenario 10: Checklist Builder & Inspection Forms
- **Platform**: Web
- **Target Route**: `/secfac/checklist-builder`
- **Role**: `ADMIN`
- **Verification**: Template builder, form sections, item compliance rules.

### Scenario 11: Immutable Audit Trail & Historical Tracking
- **Platform**: Web
- **Target Route**: `/secfac/audit-trail`
- **Role**: `ADMIN`
- **Verification**: Timestamped log of security operations, actor, action type, target reference.

### Scenario 12: Role-Based Access Control & Company Isolation
- **Platform**: Web & Mobile
- **Verification**: Security Guarding users isolated from Facility Management data; cross-company access blocked; restricted roles cannot bypass authorization.
