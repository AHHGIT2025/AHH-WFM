# Existing Feature Inventory

This document inventories the existing pre-contract and contract management features, database models, and components in the AHH WFM system.

## 1. CRM & Enquiries / Opportunities
*   **Status**: Scaffolding/Models only. No user-facing client CRM modules exist in the current UI.
*   **Prisma Models**:
    *   `PreContractProspectClient` (defines prospective client company metadata, crNumber, contact Person, address, duplicate check status).
    *   `PreContractCase` (defines the commercial case/deal opportunity title, existingClientId, businessOutcome, lifecycle status).
*   **API Routes**: None.
*   **UI Components**: None.
*   **Unified Target Location**: `/commercial/crm` and `/commercial/opportunities` (planned for Milestone CL-1).

## 2. Pre-Contract Site Surveys
*   **Status**: Configurable template structures implemented under Settings.
*   **Prisma Models**:
    *   `SurveyTemplate`, `SurveyTemplateVersion`, `SurveySection`, `SurveyElement`, `SurveyElementOption`, `SurveyRuleDefinition`.
    *   `SurveyResponse`, `SurveyResponseEvidence`, `SurveySiteCondition`.
*   **API Routes**:
    *   `/api/v1/settings/pre-contract/survey-templates` (GET/POST/PATCH)
    *   `/api/v1/settings/pre-contract/site-conditions` (GET/POST/PATCH)
*   **UI Components**:
    *   `apps/web/app/settings/pre-contract-config/SurveyConfig.tsx`
    *   `apps/web/app/settings/pre-contract-config/SiteConditionsConfig.tsx`
*   **Unified Target Location**: `/commercial/surveys` (planned for Milestone CL-2).

## 3. Transactional Costing & Cost Configuration
*   **Status**: Backend formula engine and settings configuration screens completed.
*   **Prisma Models**:
    *   `CostCategoryMaster`, `CostCategoryVersion`, `CostElementMaster`, `CostElementVersion`, `CostDriverMaster`, `CostDriverVersion`.
    *   `CostRateCardMaster`, `CostRateCardVersion`, `CostFormulaDefinition`, `CostFormulaVersion`.
    *   `CostPackageMaster`, `CostPackageVersion`, `CostPackageItem`.
*   **API Routes**:
    *   `/api/v1/settings/pre-contract/cost-configurations` (GET/POST/PATCH)
*   **UI Components**:
    *   `apps/web/app/settings/pre-contract-config/CostConfig.tsx`
*   **Unified Target Location**: `/commercial/costing` (planned for Milestone CL-3).

## 4. Existing Contract Management (Authoritative Design Authority)
*   **Status**: Fully implemented, serving as the visual, functional, and workflow design standard.
*   **Prisma Models**:
    *   `ManpowerContract`, `ManpowerContractMaterial`.
    *   `ContractManpowerRequirement`, `ContractRelieverRequirement`, `ContractShiftRequirement`.
    *   `ManpowerContractAddendum`, `ManpowerContractAddendumLineItem`.
    *   `ContractApprovalWorkflow`, `ContractApprovalLevel`, `ContractApprovalApprover`.
*   **API Routes**:
    *   `/api/v1/manpower/security-guarding/contracts` (GET/POST/PATCH/DELETE)
    *   `/api/v1/manpower/facility-management/contracts` (GET/POST/PATCH/DELETE)
    *   `/api/v1/manpower/security-guarding/contracts/[id]/workflow/[action]`
*   **UI Components**:
    *   `apps/web/app/manpower/[business]/[master]/page.tsx` (when `master === "contracts"`)
*   **Unified Target Location**: `/commercial/contracts` (redirects to the existing canonical routes to avoid duplicate logic).
