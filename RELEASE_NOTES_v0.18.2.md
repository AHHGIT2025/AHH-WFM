# Release Notes: v0.18.2 - Employee Company & Identity Integration

We are pleased to announce the release of **v0.18.2**, which completes the end-to-end integration of Company assignment, Qatar ID (QID), and Passport fields across the Workforce Management (WFM) application suite. This release bridges the gaps between Employee Directory management, Bulk Uploads, Clearance workflow snapshots, and the Mobile profile experience, while enforcing strict privacy rules and role-based masking at the API layer.

---

## What's New

### 1. Unified Employee Master & Tabbed Modals
* **Add & Edit Modal Overhaul**: Upgraded the workforce directory page (`/workforce`) to use tabbed layouts for both the **Add New Employee** and **Edit Employee** modals.
* **Identity Documents Tab**: Added a dedicated **Identity Documents** tab to input Qatar ID (QID) details, Passport Details, Sponsor, and Joining Date.
* **Validation Chronologies**: Implemented validation rules to prevent dirty/invalid data entry:
  * QID Expiry Date must be greater than or equal to the Date of Joining.
  * Passport Expiry Date must be greater than or equal to the Passport Issue Date.
  * Company assignment is strictly required for active employee status.

### 2. Company Assignment & Dynamic Filter Resets
* **Company Dropdown**: Formatted company listings as `CODE — Company Name`.
* **Cascading Filters**: Selecting or changing an employee's Company dynamically filters dependent fields (Department, Cost Center, Location, Project, Site).
* **Auto-Reset Side-Effects**: Changing an employee's company automatically flags, warns, and resets mismatched references (e.g. if the previously selected Department belongs to a different Company) to maintain data consistency.
* **Departments Extended**: Extended the `Department` model to support `companyId` relations, pre-seeded departments accordingly, and updated the respective REST endpoints.

### 3. Role-Based Privacy Masking & Security
* **BFF & REST API Protection**: Implemented strict data privacy masking at the API route layer:
  * Users with `ADMIN` or `HR` roles see full, raw QID and Passport numbers.
  * All other users see masked values showing only the last 4 digits (e.g. `*******7890`), ensuring raw credentials are never sent over the network.
* **Mobile Profile Display**: Exposes the masked QID, Expiry Date, Sponsor, and Joining Date, but completely hides Passport details from mobile viewports.

### 4. Clearance Request Snapshots
* Upgraded the `/api/v1/clearance` creation endpoint to capture immutable snapshots: `passportNumberSnapshot` and `passportExpiryDateSnapshot`.
* Updated the `/clearance/new` employee detail preview panel to display Company, Sponsor, Joining Date, QID, and Passport details (with masking rules applied).

### 5. Bulk Upload & Templates
* Updated the downloadable Excel/CSV template headers and template API to include Company Code, Sponsor, Joining Date, QID Number, QID Expiry, Passport Number, Passport Expiry, Passport Issue Date, and Passport Issuing Country.
* Integrated validator checks in the `/api/v1/employees/bulk-import` route to check for duplicate QIDs, format dates correctly, verify company associations, and enforce date chronologies.

---

## Verification & Build Status
* Verified TypeScript compilation and monorepo packaging across all workspaces.
* Tested Next.js production builds via `npm run build` successfully.
