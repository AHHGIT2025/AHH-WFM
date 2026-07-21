# SECFAC Permission-Controlled Delete & Operational Data Preservation Architecture

## Executive Summary

The SECFAC Permission-Controlled Delete Enhancement introduces fine-grained governance over deletion, deactivation, archiving, and cancellation operations across the following four core modules:
1. **Checkpoints**
2. **Checklist Builder (Templates)**
3. **Patrol Routes**
4. **Patrol Assignments**

This architecture enforces **Permission Hierarchy Separation** (editing rights do not grant delete rights), **Operational History Protection** (hard deletion is blocked when execution history exists), and **Comprehensive Audit Logging** (every hard delete, deactivate, archive, cancel, denial, or dependency block is audited).

---

## 1. Core Business Rules & Principles

1. **Delete Right Isolation:**
   - Delete permissions (`secfac.checkpoints.delete`, `secfac.checklists.delete`, `secfac.patrolRoutes.delete`, `secfac.patrolAssignments.delete`) are separate from edit permissions.
   - Default assignment: `SUPER_ADMIN` and `ADMIN`. Standard supervisors hold view/edit rights without delete rights.
2. **Operational History Preservation:**
   - Checkpoints, templates, routes, and assignments with linked executions, scan proofs, evidence, or active shifts **MUST NEVER** be physically deleted.
   - If a hard delete is requested on a record with history, the system returns `HTTP 409 Conflict` with `DELETE_BLOCKED`, listing dependency counts and prompting allowed non-destructive alternatives (`DEACTIVATE`, `ARCHIVE`, `CANCEL`).
3. **Zero-Dependency Hard Deletion:**
   - Hard deletion is allowed **ONLY** for records with zero operational dependencies (e.g. unlinked checkpoints, draft/unused checklist templates, unassigned patrol routes, or unstarted `PENDING` assignments with zero history).
4. **Independent Scope Isolation:**
   - Deletion requests strictly enforce `SECURITY_GUARDING` vs `FACILITY_MANAGEMENT` scope boundaries, company isolation, and site boundaries. Cross-scope deletion is rejected with `HTTP 403 Forbidden`.
5. **Centralized Audit Logging:**
   - Every deletion attempt, successful action, deactivation, archiving, cancellation, permission denial, or dependency block writes an immutable record to `SecfacFieldExecutionAudit`.

---

## 2. Permission Matrix

| Module | Permission Key | Granted Roles | Edit Right Grants Delete? | Non-Destructive Fallback |
| :--- | :--- | :--- | :--- | :--- |
| **Checkpoints** | `secfac.checkpoints.delete` | `SUPER_ADMIN`, `ADMIN` | **No** | `DEACTIVATE` (`isActive = false`) |
| **Checklist Builder** | `secfac.checklists.delete` | `SUPER_ADMIN`, `ADMIN` | **No** | `ARCHIVE` (`isActive = false`) |
| **Patrol Routes** | `secfac.patrolRoutes.delete` | `SUPER_ADMIN`, `ADMIN` | **No** | `DEACTIVATE` (`isActive = false`) |
| **Patrol Assignments**| `secfac.patrolAssignments.delete` | `SUPER_ADMIN`, `ADMIN` | **No** | `CANCEL` (`status = SKIPPED`, `isActive = false`) |

---

## 3. Dependency Validation & API Endpoints

### 3.1 Checkpoints
- **DELETE Endpoint:** `DELETE /api/v1/secfac/checkpoints/[checkpointId]`
- **Required Permission:** `secfac.checkpoints.delete`
- **Dependencies Checked:** `secfacPatrolRouteCheckpoints`, `secfacScanProofs`, `secfacEvidenceAttachments`, `secfacChecklistExecutions`, `secfacPatrolExecutionCheckpoints`, `secfacChecklistTemplates`, `secfacAssignments`.
- **409 Conflict Response:**
  ```json
  {
    "success": false,
    "error": "DELETE_BLOCKED",
    "message": "This checkpoint cannot be hard deleted because operational history or route assignments exist (5 references).",
    "dependencies": {
      "routeCheckpoints": 2,
      "scanProofs": 3,
      "evidenceAttachments": 0,
      "checklistExecutions": 0,
      "patrolExecutionCheckpoints": 0,
      "checklistTemplates": 0,
      "assignments": 0
    },
    "allowedAction": "DEACTIVATE"
  }
  ```
- **Deactivate Endpoint:** `POST /api/v1/secfac/checkpoints/[checkpointId]/deactivate`

### 3.2 Checklist Builder
- **DELETE Endpoint:** `DELETE /api/v1/secfac/checklists/[templateId]`
- **Required Permission:** `secfac.checklists.delete`
- **Dependencies Checked:** `secfacChecklistExecutions`, `secfacAssignments`.
- **Archive Endpoint:** `POST /api/v1/secfac/checklists/[templateId]/archive`

### 3.3 Patrol Routes
- **DELETE Endpoint:** `DELETE /api/v1/secfac/patrol-routes/[routeId]`
- **Required Permission:** `secfac.patrolRoutes.delete`
- **Dependencies Checked:** `secfacAssignments`, `secfacPatrolExecutions`.
- **Deactivate Endpoint:** `POST /api/v1/secfac/patrol-routes/[routeId]/deactivate`

### 3.4 Patrol Assignments
- **DELETE Endpoint:** `DELETE /api/v1/secfac/assignments/[assignmentId]`
- **Required Permission:** `secfac.patrolAssignments.delete`
- **Condition for Hard Delete:** Status must be `PENDING` AND zero executions/scans/evidence exist.
- **Cancel Endpoint:** `POST /api/v1/secfac/assignments/[assignmentId]/cancel`

---

## 4. Audit Trail Integration

All events are recorded in `SecfacFieldExecutionAudit` with `actionSource` formatted as `SECFAC_DELETE_CONTROL_<MODULE>`:

- `CHECKPOINT_HARD_DELETE`
- `CHECKPOINT_DEACTIVATE`
- `CHECKPOINT_DEPENDENCY_BLOCKED`
- `CHECKPOINT_PERMISSION_DENIED`
- `CHECKLIST_TEMPLATE_HARD_DELETE`
- `CHECKLIST_TEMPLATE_ARCHIVE`
- `CHECKLIST_TEMPLATE_DEPENDENCY_BLOCKED`
- `CHECKLIST_TEMPLATE_PERMISSION_DENIED`
- `PATROL_ROUTE_HARD_DELETE`
- `PATROL_ROUTE_DEACTIVATE`
- `PATROL_ROUTE_DEPENDENCY_BLOCKED`
- `PATROL_ROUTE_PERMISSION_DENIED`
- `PATROL_ASSIGNMENT_HARD_DELETE`
- `PATROL_ASSIGNMENT_CANCEL`
- `PATROL_ASSIGNMENT_DEPENDENCY_BLOCKED`
- `PATROL_ASSIGNMENT_PERMISSION_DENIED`

---

## 5. User Interface Workflow

1. **Actions Menu:**
   - Delete button is visible **only** to users possessing the specific `secfac.<module>.delete` permission.
2. **Confirmation Modal:**
   - Standard confirmation alerts user about zero-dependency requirement.
3. **Dependency Dialog:**
   - If HTTP 409 is returned from API, a UI prompt clearly explains why deletion was blocked, shows dependency counts, and asks if the user wishes to perform the allowed non-destructive action (`DEACTIVATE`, `ARCHIVE`, or `CANCEL`).
4. **Reason Prompt:**
   - Deactivation, archiving, and cancellation require the user to input an operational reason, which is logged directly into the audit trail.
