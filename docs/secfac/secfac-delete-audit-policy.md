# SECFAC Delete & Operational Data Governance Audit Policy

## 1. Scope and Authority

This document defines the official operational governance and audit logging policy for delete, deactivate, archive, and cancel operations within the SECFAC (Security Guarding and Facility Management) subsystem of AHH WFM.

This policy is mandatory for all system administrators, operations managers, control room supervisors, and software engineering agents.

---

## 2. Mandatory Audit Logging Policy

1. **Immutable Audit Trail:**
   - All delete actions (whether successful, blocked, denied, or state transitions) MUST be logged immediately in `SecfacFieldExecutionAudit`.
   - Audit entries cannot be modified or deleted by any user or administrator.

2. **Logged Event Attributes:**
   - **`actionSource`**: `SECFAC_DELETE_CONTROL_<MODULE>` (e.g. `SECFAC_DELETE_CONTROL_CHECKPOINT`)
   - **`actionType`**: Unified action identifier (e.g. `CHECKPOINT_HARD_DELETE`, `CHECKPOINT_DEPENDENCY_BLOCKED`)
   - **`entityType`**: `CHECKPOINT`, `CHECKLIST_TEMPLATE`, `PATROL_ROUTE`, `PATROL_ASSIGNMENT`
   - **`entityId`**: Target entity UUID
   - **`userId`**: Authenticated user ID
   - **`userRole`**: User role at execution time
   - **`permission`**: Required permission string checked
   - **`operationType`**: `SECURITY_GUARDING` or `FACILITY_MANAGEMENT`
   - **`siteId`**: Associated site ID
   - **`resultStatus`**: `SUCCESS`, `BLOCKED`, `DENIED`, `FAILED`
   - **`reason`**: User-provided justification or system denial reason
   - **`resultMessage`**: Full execution message

---

## 3. Data Governance & Non-Destructive Alternatives

| Action Type | Condition | Destructive? | System Behavior |
| :--- | :--- | :--- | :--- |
| **HARD_DELETE** | 0 history records / unstarted `PENDING` | **Yes** | Permanent removal from database |
| **DEPENDENCY_BLOCKED** | History records > 0 / started assignment | **No** | Rejects with `HTTP 409 Conflict`, suggests alternative |
| **DEACTIVATE** | Entity active | **No** | Sets `isActive = false`, preserves history |
| **ARCHIVE** | Template active | **No** | Sets `isActive = false`, hides from new assignments |
| **CANCEL** | Assignment pending/overdue | **No** | Sets `status = SKIPPED`, `isActive = false`, logs reason |

---

## 4. Compliance Verification

Audit logs are subject to periodic security reviews and compliance audits. Any attempt to bypass permission checks or perform unauthorized data purging will trigger an automatic security alarm and be reported in the Control Room Audit Log.
