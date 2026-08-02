# Duplication Retirement Plan

This plan details how duplicate pre-contract configuration views and contract lists will be phased out as later milestones are implemented.

## 1. Phase 1: Pre-Contract Config Retirement
*   **Trigger**: Completion of Milestone CL-2 (Site Surveys) and CL-3 (Costing).
*   **Current Duplicate**: `apps/web/app/settings/pre-contract-config/page.tsx` (and associated panels).
*   **Retirement Steps**:
    1.  Relocate survey template forms to `/commercial/surveys/settings`.
    2.  Relocate costing element formulas to `/commercial/costing/settings`.
    3.  Configure redirects from `settings/pre-contract-config` to their new commercial counterparts.
    4.  Update references in settings navigation sidebar.

## 2. Phase 2: Duplicate Contract Directories Retirement
*   **Trigger**: Completion of Milestone CL-5 (Contract Activation & Addendums).
*   **Current Duplicate**: Separate `contracts` menus inside Security Guarding and Facility Management.
*   **Retirement Steps**:
    1.  Embed scope filtering logic (Security vs. FM) directly inside `/commercial/contracts/page.tsx`.
    2.  Migrate the contract details drawer/workspace to `/commercial/contracts/[id]`.
    3.  Remove legacy `contracts` subfolders from `/manpower/security-guarding/` and `/manpower/facility-management/`.
    4.  Decommission duplicate API endpoints `/api/v1/manpower/security-guarding/contracts` in favor of a single unified `/api/v1/commercial/contracts` route group.
