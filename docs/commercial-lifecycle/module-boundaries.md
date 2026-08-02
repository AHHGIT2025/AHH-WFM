# Module Boundaries

This document defines the roles, edit permissions, and database constraints separating Sales, Operations, Finance, and Legal teams across the commercial lifecycle.

## 1. Role Boundaries & Edit Rights
*   **Sales**:
    *   *Rights*: Full create/edit access to Enquiries, Opportunities, and Quotations.
    *   *Restrictions*: Cannot modify Costing rate cards, Site Survey results, or Contract statuses.
*   **Operations**:
    *   *Rights*: Full write access to Site Survey schedules, site condition responses, and Mobilisation checklists.
    *   *Restrictions*: Cannot modify costing margins, selling prices, or legal terms.
*   **Finance**:
    *   *Rights*: Complete control over Costing models, margin validations, rate cards, and financial approvals.
    *   *Restrictions*: Cannot edit customer contacts or legal clause deviation flags.
*   **Legal**:
    *   *Rights*: Complete control over Contract terms, approval status transitions (DRAFT -> APPROVED), and Addendum authorization.
    *   *Restrictions*: Cannot alter operations shift counts or resource schedules.

## 2. Shared Workspaces
The AHH WFM system utilizes shared workspaces where multiple departments view a deal, but access controls are enforced on a field-level and tab-level basis:
*   *Overview Header*: Shared (Sales/Ops/Finance/Legal) - View only.
*   *Site Survey Tab*: Writeable by Operations only.
*   *Costing Tab*: Writeable by Finance only.
*   *Legal Terms Tab*: Writeable by Legal only.

## 3. Database Constraints
The backend enforces these boundaries using role validations:
*   Prisma schema relationships bind transactions: a `Costing` model cannot be verified unless its predecessor `SurveyResponse` is complete and approved.
*   A `Quotation` cannot transition to a `Contract` without explicit approvals from Finance (margin audit) and Legal (terms review).
*   Any unauthorized modification of these states will reject the transaction with a `403 Forbidden` error.
