# Existing Contract Design Analysis

This document details the visual, interaction, and workflow specifications of the authoritative Contract module, which serves as the visual benchmark for the unified Commercial & Contracts area.

## 1. UX & Visual Architecture
*   **Font & Typography**: Uses `Inter` (Hanken Grotesk is loaded but Inter is primary). Body text uses `body-md` (14px) and table headers use `label-md` or `label-sm` with bold weight.
*   **Colors**: 
    *   Primary text and headers: `#091426` (Deep slate).
    *   Active/Interactive links: `#0058be` (Corporate Blue).
    *   Surfaces: Card panels are pure white (`#ffffff`) with 1px border using `#DADCE0` (border-subtle) or `#c5c6cd` (outline-variant).
    *   No heavy drop shadows; depth is communicated via tonal layers and low-contrast borders.
*   **Layout Grid**: Fixed-fluid hybrid desktop design with a 260px left sidebar and 16px to 24px vertical and horizontal padding rhythm.

## 2. Dynamic Workflow States
The contract lifecycle operates under strict state transitions:
1.  **DRAFT**: Contracts in draft state are fully mutable. Users can view, edit terms, add manpower/shift requirements, upload attachments, or delete the record.
2.  **APPROVED**: Transitioned from Draft upon workflow authorization. They are immutable; users can only view details or trigger activation.
3.  **ACTIVE**: Transitioned from Approved. Once activated, the contract terms cannot be edited directly. To alter scope, users must create a `ManpowerContractAddendum`. Deactivation or termination requires an explicit transaction request.
4.  **REJECTED**: Drafts that failed workflow approval. They are editable for corrections and can be resubmitted.

## 3. Scope Controls & Amendments
*   **Addendums**: Creating a `ManpowerContractAddendum` is only permitted for contracts in `ACTIVE` status. Direct editing of active contract terms is strictly prohibited to maintain compliance.
*   **Requirements Split**:
    *   `ContractManpowerRequirement`: Baseline headcounts and positions.
    *   `ContractRelieverRequirement`: Reliever pools assigned to bridge gaps.
    *   `ContractShiftRequirement`: Shifts allocated to worksites.

## 4. Audit & Verification
*   **Audit Logging**: Changes in contract versions and statuses trigger automatic updates in the audit ledger, keeping full historical traces.
*   **System Attachments**: Checked for integrity (verified, mismatch, unverified) via `SystemAttachment` model hashes.
