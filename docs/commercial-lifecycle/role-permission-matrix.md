# Role Permission Matrix

This document maps user roles to CRUD capabilities across all modules of the unified Commercial & Contracts suite.

| User Role | Dashboard | CRM & Enquiries | Site Surveys | Costing Models | Quotations | Contracts & Addendums | Handover Checklist |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Sales Executive** | R | RW | R | RW | RW | R | R |
| **Operations Surveyor** | R | R | RW | R | R | R | R |
| **Operations Manager** | R | R | R | R | R | R | RW |
| **Finance Estimator** | R | R | R | RW | R | R | R |
| **Finance Lead** | R | R | R | RWA | R | R | R |
| **Legal Counsel** | R | R | R | R | RW | RWA | R |
| **Admin / Super Admin** | RW | RW | RW | RW | RW | RWA | RW |

### Legend:
*   **R**: Read Only
*   **W**: Write (Create/Edit)
*   **A**: Approve (Status transitions / Verification gates)
*   **-**: No Access

### Scope Controls:
*   **Security Guarding Scope**: Users belonging to Security Guarding can only view/modify records classified under Security.
*   **Facility Management Scope**: Users belonging to Facility Management can only view/modify records classified under Facility Services.
*   **Admin Override**: Admin and Super Admin users can toggle between scopes via a global switch or access all consolidated tables.
