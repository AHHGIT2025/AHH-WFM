# PW-6 Universal Approval Center Playwright Test Specification

## Target Features
1. **Approval Center Navigation & Layout**:
   - Navigate to `/approvals` via Sidebar or Dashboard My Approvals widget.
   - Verify page title "Universal Approval Center", subtitle, and quick stats summary.
2. **Inbox vs Outbox Tabs**:
   - Switch between "Pending Review (Inbox)" and "My Actions (Outbox)".
   - Verify tab badges reflect live counts.
3. **Filtering & Search**:
   - Filter by module (Commercial Costing, Proposals, Clearance, Leave, etc.).
   - Search by reference ID or subject.
4. **Approval Detail View (`/approvals/[id]`)**:
   - Inspect Request Overview, Business Key Attributes, and Stage Info.
   - Inspect Vertical Lifecycle Timeline with previous actions, timestamps, and actors.
   - Validate Decision Action Panel (Remarks input, Approve, Return, Reject buttons, Confirmation Modal).
5. **Dashboard Integration**:
   - Verify "My Approvals Portal" widget on executive dashboard (`/`).
   - Click "View Inbox" / "View Outbox" buttons and verify direct deep navigation.
