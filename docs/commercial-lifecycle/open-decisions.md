# Open Decisions & Technical Risks

This document highlights critical architectural decisions, security controls, and technical risks requiring review before starting subsequent milestones.

## 1. CRM Prospect-to-Client Access Rules
*   **Context**: Currently, Workforce Directory acts as the single source of truth for active clients. Sales executives need access to log new prospects but must not corrupt active master records.
*   **Decisions Needed**:
    1.  *Promotion Isolation*: Should the master `Client` record be auto-generated upon Contract Approval, or does it require manual verification by an Admin?
    2.  *Sales Write Boundaries*: Should Sales users retain edit rights to promoted `Client` fields, or do they become read-only once promoted?

## 2. Notification Channel Exceptions in Phase 5D Pilot
*   **Context**: Operational governance rules state that external email, SMS, push notifications, and WhatsApp remain disabled during the Phase 5D pilot.
*   **Decisions Needed**:
    1.  *Approval Workflows*: How do we notify Finance Leads and Legal Counsels of pending approvals (e.g. Costing, Contract) if email/push is blocked?
    2.  *Fallback Solution*: We will rely entirely on the in-app "Active Team Work Queue" and notification bells within the layout shell until pilot restrictions are lifted.

## 3. Scope Separation Constraints
*   **Context**: Security Guarding and Facility Management data must remain strictly isolated. A Security Guarding user must not access Facility Management data and vice-versa.
*   **Decisions Needed**:
    1.  *Commercial Overlap*: In the CRM and Opportunity pipeline, some prospective clients query for "Combined Security & Facility services."
    2.  *Enforcement Rule*: Any combined deal must be partitioned into two distinct opportunities under separate scopes, or only be viewable by authorized Admin/Super Admin profiles.
