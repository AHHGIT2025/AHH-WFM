# Data Ownership Specification

This document outlines data ownership and source of truth policies for workforce, location, and contract records in AHH WFM.

## 1. Employees / Workforce Directory
*   **Source of Truth**: SuccessFactors (SF) Sync. HR is the sole creator and manager.
*   **Role**: Employee master records.
*   **Policy**: WFM can read and sync employee data but cannot write new employees directly. Only deployment statuses and duty states are managed within WFM.

## 2. Prospective Clients vs. Master Clients
*   **Source of Truth**: WFM Commercial Database.
*   **Role**: Pre-contract client prospects (`PreContractProspectClient`).
*   **Policy**: Managed by Sales. Upon contract approval, the prospect is automatically promoted to the master `Client` directory.

## 3. Sites / Worksites
*   **Source of Truth**: Operations Department.
*   **Role**: Physical locations where manpower is deployed.
*   **Policy**: Pre-contract prospective sites are created during survey dispatch. Once a contract is activated, these sites are finalized under the master `Site` table, which is managed and maintained by Operations.

## 4. Cost Configurations & Formula Rules
*   **Source of Truth**: Finance Department.
*   **Role**: Formulas and rates for calculating relievers, allowances, overtime, and margins.
*   **Policy**: Only Finance Administrators can modify cost elements, rate cards, or formulas under Settings. Sales estimators apply these templates but cannot modify the underlying formulas.

## 5. Contracts & Addendums
*   **Source of Truth**: Legal & Finance Departments.
*   **Role**: Legal and financial agreements with clients.
*   **Policy**: Read-only for Sales and Operations once active. Amendments (Addendums) are created only for active contracts and must undergo formal Finance and Legal approval before activation.
