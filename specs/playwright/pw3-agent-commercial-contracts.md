# PW-3 Commercial & Contracts Critical User Journeys

## Overview
Comprehensive Playwright test plan covering pre-contract commercial lifecycle (Site Surveys, Costing, Proposals), contract conversion, active contract lifecycle, amendments/addendums, centralized workflow governance, SoD, and RBAC.

## Scenario 1: Commercial Executive Dashboard & Entry
- **Target Route**: `/commercial/dashboard`
- **User Role**: `ADMIN` / `COMMERCIAL_MANAGER`
- **Actions**: View Commercial Dashboard cards, pipeline metrics, active contracts summary, and module links.
- **Assertions**: Assert visibility of Commercial Dashboard header, key performance metrics, and navigation shortcuts.

## Scenario 2: Site Survey Lifecycle & Structural Master Data
- **Target Route**: `/commercial/surveys`
- **User Role**: `ADMIN` / `COMMERCIAL_USER`
- **Actions**: View survey listings, inspect site/client associations, configurable survey structures, draft state, and workflow submission.
- **Assertions**: Assert survey listing grid, site condition data, draft status, and submission controls.

## Scenario 3: Pre-Contract Costing Engine & Calculation Inputs
- **Target Route**: `/commercial/costing`
- **User Role**: `ADMIN` / `COMMERCIAL_USER`
- **Actions**: View costing listings, inspect manpower/service cost line items, visible calculation breakdown, and draft updating.
- **Assertions**: Assert costing calculation summary cards, line item details, and workflow submission triggers.

## Scenario 4: Commercial Proposal Generation & Lifecycle
- **Target Route**: `/commercial/proposals`
- **User Role**: `ADMIN` / `COMMERCIAL_USER`
- **Actions**: View proposal listings, inspect commercial terms, pricing totals, proposal state (DRAFT / SUBMITTED / APPROVED), and document links.
- **Assertions**: Assert proposal details table, total contract value displays, and approval workflow status badges.

## Scenario 5: Client Acceptance & Proposal Transition
- **Target Route**: `/commercial/proposals`
- **User Role**: `ADMIN` / `COMMERCIAL_MANAGER`
- **Actions**: Inspect accepted/rejected proposal states, acceptance evidence, immutable history, and transition eligibility toward Contract Conversion.
- **Assertions**: Assert proposal status badge (`ACCEPTED`), acceptance audit timestamp, and conversion trigger enablement.

## Scenario 6: Contract Conversion & Source Commercial Linkage
- **Target Route**: `/commercial/contract-conversion`
- **User Role**: `ADMIN` / `COMMERCIAL_MANAGER`
- **Actions**: Inspect eligible accepted proposals for conversion, conversion trigger, resulting contract master record creation, and preserved commercial source linkage.
- **Assertions**: Assert contract conversion table, source proposal linkage ID, and contract creation confirmation.

## Scenario 7: Active Contract Lifecycle & Requirement Inheritance
- **Target Route**: `/commercial/contracts`
- **User Role**: `ADMIN` / `COMMERCIAL_USER`
- **Actions**: View contract master list, active contract detail card, inherited requirement slots, and lifecycle state (`ACTIVE` / `EXPIRED` / `TERMINATED`).
- **Assertions**: Assert contract number, client name, effective date range, and active status indicator.

## Scenario 8: Contract Variation & Post-Award Addendums
- **Target Route**: `/commercial/amendments`
- **User Role**: `ADMIN` / `COMMERCIAL_MANAGER`
- **Actions**: View contract addendum/variation listings, inspect ADD / REMOVE requirement modifications, effective dates, and workflow approval status.
- **Assertions**: Assert addendum title, revision number, effective date, and workflow state (`DRAFT` / `APPROVED`).

## Scenario 9: Centralized Workflow Governance & Segregation of Duties
- **Target Route**: `/settings/workflow-setup`
- **User Role**: `ADMIN`
- **Actions**: Inspect centralized workflow definitions for Commercial modules (Costing, Proposal, Addendum), role-based approver assignments, and approval history.
- **Assertions**: Assert centralized workflow template assignment for Commercial scope without module-local workflow definitions.

## Scenario 10: Role-Based Access Control & Scope Isolation
- **Target Route**: `/commercial/dashboard` & `/commercial/contracts`
- **User Role**: `RESTRICTED_COMMERCIAL_USER`
- **Actions**: Attempt navigation to unauthorized settings/modules and verify menu scope filtering and direct URL access denial.
- **Assertions**: Assert role-restricted navigation filtering and access denied error banners.
