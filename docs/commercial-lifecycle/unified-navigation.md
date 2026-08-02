# Unified Navigation Specification

This document specifies the routing structure, sidebar items, and layout parameters for the unified `Commercial & Contracts` workspace.

## 1. Sidebar Structure
When a user navigates to any URL starting with `/commercial/*`, the application shell overrides the default sidebar to display the **Commercial & Contracts** menu:
*   **← Back to Main Menu** (`/`)
*   **Commercial Dashboard** (`/commercial/dashboard`)
*   **CRM & Enquiries** (`/commercial/crm`)
*   **Opportunities** (`/commercial/opportunities`)
*   **Site Surveys** (`/commercial/surveys`)
*   **Costing** (`/commercial/costing`)
*   **Quotations** (`/commercial/quotations`)
*   **Contracts** (`/commercial/contracts` -> redirects to canonical contract routes)
*   **Operations Handover** (`/commercial/handover`)
*   **Activities & Follow-Ups** (`/commercial/activities`)
*   **Reports** (`/commercial/reports`)

## 2. URL Routing Table
All commercial subroutes are clustered under `/commercial/` to ensure clean workspace isolation:
*   `/commercial/dashboard`: Consolidated operational KPI and work queue hub.
*   `/commercial/crm`: Prospective client database and enquiry intake.
*   `/commercial/opportunities`: Active sales deal pipeline kanban/list.
*   `/commercial/surveys`: Dispatch and capture of site audits.
*   `/commercial/costing`: Margin configuration calculations.
*   `/commercial/quotations`: Customer proposals and clauses.
*   `/commercial/contracts`: Access router that redirects to `/manpower/[business]/contracts` depending on user permissions.
*   `/commercial/handover`: Mobilisation and operational readiness sign-offs.

## 3. Breadcrumb & Navigation Rules
Every page in the commercial suite must display standard breadcrumb trails for clear context:
*   *Format*: `Commercial & Contracts > [Module Name] > [Record ID]`
*   *Example*: `Commercial & Contracts > CRM & Enquiries > ENQ-9902`
*   Main Menu fallback allows quick return to the WFM overview panel via the "← Back to Main Menu" link.
