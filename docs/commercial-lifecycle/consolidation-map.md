# Consolidation Map

This map outlines the transition path of database models, API endpoints, and web components from their current locations into the consolidated `Commercial & Contracts` workspace.

## 1. Route Mapping
| Feature / Screen | Current Path | Consolidated Path | CL-0 Status / Decision |
| :--- | :--- | :--- | :--- |
| **Commercial Dashboard** | None | `/commercial/dashboard` | **NEW** (CL-0 shell) |
| **CRM & Enquiries** | None | `/commercial/crm` | **NEW** (Placeholder) |
| **Opportunities** | None | `/commercial/opportunities` | **NEW** (Placeholder) |
| **Site Surveys** | None | `/commercial/surveys` | **NEW** (Placeholder) |
| **Costing** | None | `/commercial/costing` | **NEW** (Placeholder) |
| **Quotations** | None | `/commercial/quotations` | **NEW** (Placeholder) |
| **Contracts** | `/manpower/[business]/contracts` | `/commercial/contracts` | **REUSE** (Redirects to canonical routes) |
| **Handover** | None | `/commercial/handover` | **NEW** (Placeholder) |
| **Activities** | None | `/commercial/activities` | **NEW** (Placeholder) |
| **Reports** | None | `/commercial/reports` | **NEW** (Placeholder) |

## 2. API Endpoint Mapping
| Feature | Current API | Consolidated Target API | Target Milestone |
| :--- | :--- | :--- | :--- |
| **Enquiries** | None | `/api/v1/commercial/enquiries` | CL-1 |
| **Opportunities** | None | `/api/v1/commercial/opportunities` | CL-1 |
| **Site Surveys** | `/api/v1/settings/pre-contract/survey-templates` | `/api/v1/commercial/surveys` | CL-2 (Extend) |
| **Costing** | `/api/v1/settings/pre-contract/cost-configurations` | `/api/v1/commercial/costings` | CL-3 (Extend) |
| **Quotations** | None | `/api/v1/commercial/quotations` | CL-4 |
| **Contracts** | `/api/v1/manpower/[business]/contracts` | Reused directly | CL-5 (Reuse) |

## 3. Database Model Mapping
All existing models in `schema.prisma` are preserved and will be extended without structural changes:
- `PreContractProspectClient` (CRM) -> Reused
- `PreContractCase` (Opportunities) -> Reused
- `PreContractSurvey` (Surveys) -> Reused
- `CostCategoryMaster` & `CostElementMaster` (Costing) -> Reused
- `ManpowerContract` (Contracts) -> Reused
