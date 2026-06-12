# Release Notes v0.7.0 — Enterprise Multi-Level Leave Workflow & SLA Escalation

This release implements Phase 3B of the AHH WFM Leave Management system, adding enterprise-grade multi-level approval matrices, approval delegation capabilities, SLA tracking parameters, and automated escalation checking.

## Key Features

### 1. Multi-Level Approval Workflow
- Seeded sequential approval workflow steps matching the schema:
  - **Standard Annual Leave Workflow**: Supervisor $\rightarrow$ Manager $\rightarrow$ HR approval checklist.
  - **Sick & Emergency Leave Workflow**: Supervisor $\rightarrow$ HR approval check.
  - **Business Travel Auto-Approval**: Automatic HR sign-off validation for travel duration $\le$ 1 day.
- Added matrix-based routing filters supporting role checks, employee groups, and department tags.

### 2. Approval Delegation Engine
- Employees can delegate their approval authority to other registered users.
- Delegation rules specify `delegateApproverId`, `validFrom`, `validTo`, and `reason` metadata.
- Integrates dynamically with the approvals queues, shifting requests to the delegate’s console tab during delegation windows.

### 3. SLA Tracking & Escalation Chron
- Added precise timestamps for logging milestones: `submittedAt`, `firstActionAt`, `approvedAt`, `approvalDurationHours`.
- Escalation daemon automatically bumps requests pending beyond 72 hours to the next hierarchical tier and increments the `escalationCount` counter.

### 4. Consolidated Web & Mobile Interfaces
- **Web Approvals Queue Console**: Segmented tabs for **Direct Queue**, **Delegated Queue**, and **Escalated Queue** details.
- **Timeline log viewer modal**: Full display of historic transition stages, timestamps, actors, and remarks comments.
- **Mobile progress tracking stepper**: High-fidelity indicator checklist displaying approval path and status updates for employees.

## API Additions
- `POST /api/v1/leaves/approve` — Process step approvals, check delegation rules, and run balance deductions.
- `POST /api/v1/leaves/reject` — Process request rejections and restore pending days.
- `GET /api/v1/leaves/history` — List history timelines.
- `GET/POST /api/v1/approval-workflows` — Fetch/create workflows.
- `GET/POST /api/v1/approval-delegations` — Create/list active delegations.
