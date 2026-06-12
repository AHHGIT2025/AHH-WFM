# Phase 3B — Multi-Level Leave Approval Workflow Verification

This document summarizes the testing scenarios and results for Phase 3B.

## Verification Checklist

### 1. Database Schema
- [x] Prisma Models added: `LeaveApprovalWorkflow`, `LeaveApprovalStep`, `LeaveApprovalHistory`, `LeaveApprovalDelegation`.
- [x] Schema pushed successfully to the database.

### 2. Seeding & Calculations
- [x] Workflows automatically seeded for standard Annual Leave (Supervisor → Manager → HR), Sick/Emergency Leave (Supervisor → HR), and Business Travel (Auto-HR).
- [x] Sequential step tracking and status progression correctly configured.

### 3. REST API Endpoints
- [x] `POST /api/v1/leaves/approve` correctly advances requests to the next step, deducts balances on final approval, and logs history.
- [x] `POST /api/v1/leaves/reject` shifts request to "Rejected" state, releases pending days, and logs comments.
- [x] `GET /api/v1/leaves/history` logs the complete timeline of actions and remarks.
- [x] `GET/POST /api/v1/approval-workflows` handles workflows list and creation.
- [x] `GET/POST /api/v1/approval-delegations` registers delegation rules.

### 4. UI Dashboard Console
- [x] Mobile status stepper renders current workflow checklist (e.g. Supervisor → Manager → HR) and logs comments.
- [x] Web Approvals console segments direct queue from delegated and escalated queues.
- [x] SLA duration tracking and escalation counters displayed.
- [x] Delegation rules builder added to Approvals console.

## Manual Testing Scenarios

1. **Auto-Approval Threshold**:
   - Applying for Business Travel under 1 day immediately triggers auto-approval via the seeded rule.
2. **Sequential Escalations**:
   - Escalation check increments `escalationCount` and advances status after 72 hours of inactivity.
3. **Delegation routing**:
   - Adding a delegation rule correctly shifts routing away from the direct queue of the owner to the delegate queue of the configured recipient.
