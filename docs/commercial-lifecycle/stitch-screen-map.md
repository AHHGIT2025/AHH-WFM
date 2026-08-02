# Stitch Screen Map

This document maps all 32 screens designed for the unified **Commercial & Contracts** consolidated module in Stitch project `11015114151876757685`.

## 1. Core Foundation Screens (Completed & Generated)

The following 8 core foundation screens have been successfully generated and established inside the Stitch project:

### Screen 1: Commercial Dashboard Shell
*   **Stitch Screen ID**: `16b652d0794a4be0bf11583d289cafcf`
*   **Path**: `/commercial/dashboard`
*   **Purpose**: Display main sales pipelines, win rates, and cross-department task lists.
*   **Status**: `Completed`

### Screen 2: Unified Navigation Layout
*   **Stitch Screen ID**: `7fe441e16208461b8db805e90a722938`
*   **Path**: `/commercial/*`
*   **Purpose**: Persistent side nav bar layout and viewport template.
*   **Status**: `Completed`

### Screen 3: Shared Record Workspace (Enquiry Details)
*   **Stitch Screen ID**: `0428c59578214edf8f2a425ed296af92`
*   **Path**: `/commercial/crm/[id]`
*   **Purpose**: Tabbed layout for prospective client contacts, qualification notes, and details.
*   **Status**: `Completed`

### Screen 4: Related-Record Lifecycle Panel
*   **Stitch Screen ID**: `6136cf7d21c54a6c93ee83f958fef496`
*   **Path**: `/commercial/dashboard` component
*   **Purpose**: Horizontal progression visualizer linking Enquiry -> Opportunity -> Costing -> Quotation -> Contract.
*   **Status**: `Completed`

### Screen 5: Team Work Queue (Cross-Department Tasks)
*   **Stitch Screen ID**: `fe01cbfd2857488a804f755af570744c`
*   **Path**: `/commercial/dashboard` component
*   **Purpose**: Compact list of critical tasks for Sales, Operations, Finance, and Legal.
*   **Status**: `Completed`

### Screen 6: Unified Activity Timeline
*   **Stitch Screen ID**: `7d67ab7b9bf84de3a200bcea332495e4`
*   **Path**: `/commercial/dashboard/activities`
*   **Purpose**: Vertical chronological event tracking with user avatars and status changes.
*   **Status**: `Completed`

### Screen 7: Unified Version and Audit History
*   **Stitch Screen ID**: `8664022c129649ea860f0e0176752309`
*   **Path**: `/commercial/dashboard/versions`
*   **Purpose**: Side-by-side text diffing for contract clauses and rate card revisions.
*   **Status**: `Completed`

### Screen 8: Existing Contract Source Traceability
*   **Stitch Screen ID**: `53409c17e0ab4655ba36175c3d36f7f4`
*   **Path**: `/commercial/contracts` (Router context)
*   **Purpose**: Contract workspace trace links back to the source survey, costing package, and quotation.
*   **Status**: `Completed`

---

## 2. Planned Screens (Under Construction / Future Milestones)

The remaining 24 screens are planned for subsequent milestones (CL-1 through CL-6) and are currently set as **Under Construction** in the implementation map:

| Screen # | Screen Name | Path | Target Milestone | Status |
|---|---|---|---|---|
| 9 | **Enquiry Intake Form** | `/commercial/crm/new` | CL-1: CRM & Opportunities | `Under Construction` |
| 10 | **Enquiry List Ledger** | `/commercial/crm` | CL-1: CRM & Opportunities | `Under Construction` |
| 11 | **Opportunity Kanban Pipeline** | `/commercial/opportunities` | CL-1: CRM & Opportunities | `Under Construction` |
| 12 | **Opportunity List Ledger** | `/commercial/opportunities/list` | CL-1: CRM & Opportunities | `Under Construction` |
| 13 | **Opportunity Detail Workspace** | `/commercial/opportunities/[id]` | CL-1: CRM & Opportunities | `Under Construction` |
| 14 | **Prospect Client Profiles** | `/commercial/crm/prospects` | CL-1: CRM & Opportunities | `Under Construction` |
| 15 | **Site Survey Dispatch** | `/commercial/surveys/dispatch` | CL-2: Pre-Contract Surveys | `Under Construction` |
| 16 | **Survey Job Calendar** | `/commercial/surveys/calendar` | CL-2: Pre-Contract Surveys | `Under Construction` |
| 17 | **Survey Field Form** | `/commercial/surveys/new` | CL-2: Pre-Contract Surveys | `Under Construction` |
| 18 | **Survey Results Workspace** | `/commercial/surveys/[id]` | CL-2: Pre-Contract Surveys | `Under Construction` |
| 19 | **Risk & Hazard Registry** | `/commercial/surveys/[id]/risks` | CL-2: Pre-Contract Surveys | `Under Construction` |
| 20 | **Template Configurator** | `/settings/pre-contract-config/templates` | CL-2: Pre-Contract Surveys | `Under Construction` |
| 21 | **Survey Manager Dashboard** | `/commercial/surveys/dashboard` | CL-2: Pre-Contract Surveys | `Under Construction` |
| 22 | **Site Conditions Audit** | `/commercial/surveys/[id]/conditions` | CL-2: Pre-Contract Surveys | `Under Construction` |
| 23 | **Cost Elements Master** | `/settings/pre-contract-config/elements` | CL-3: Costing & Configuration | `Under Construction` |
| 24 | **Rate Cards Ledger** | `/settings/pre-contract-config/rates` | CL-3: Costing & Configuration | `Under Construction` |
| 25 | **Cost Package Builder** | `/commercial/costing/new` | CL-3: Costing & Configuration | `Under Construction` |
| 26 | **Margin Calibration Matrix** | `/commercial/costing/[id]/margins` | CL-3: Costing & Configuration | `Under Construction` |
| 27 | **Reliever Calculations Tab** | `/commercial/costing/[id]/relievers` | CL-3: Costing & Configuration | `Under Construction` |
| 28 | **Formula Debugger Console** | `/settings/pre-contract-config/debugger` | CL-3: Costing & Configuration | `Under Construction` |
| 29 | **Finance Verification Panel** | `/commercial/costing/[id]/audit` | CL-3: Costing & Configuration | `Under Construction` |
| 30 | **Cost Package Detail Workspace** | `/commercial/costing/[id]` | CL-3: Costing & Configuration | `Under Construction` |
| 31 | **Quotation Compiler Workspace** | `/commercial/quotations/new` | CL-4: Client Quotations | `Under Construction` |
| 32 | **Quotation Detail Page** | `/commercial/quotations/[id]` | CL-4: Client Quotations | `Under Construction` |
