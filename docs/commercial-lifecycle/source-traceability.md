# Source Traceability Specification

This document defines the data models and trace references required to audit a contract's lineage back to its original customer request.

## 1. Lineage Path
Every active contract must maintain deterministic references to its preceding lifecycle records:

```
[ManpowerContract] 
       │
       ▼ (Reference ID)
[Quotation]
       │
       ▼ (Reference ID)
[Costing Package / Model]
       │
       ▼ (Reference ID)
[Survey Response / Site Condition]
       │
       ▼ (Reference ID)
[Opportunity Case]
       │
       ▼ (Reference ID)
[CRM Enquiry]
```

## 2. Core Fields in schema.prisma
To enforce this lineage, the following fields are defined:
*   `ManpowerContract.quotationId`: Ties the legal contract to the finalized quote.
*   `Quotation.costingPackageId`: Ties the customer proposal to the verified costing package.
*   `CostingPackage.surveyResponseId`: Ties the financial rates to the physical site surveyor findings.
*   `SurveyResponse.opportunityId`: Ties the site surveyor audit to the commercial opportunity case.
*   `PreContractCase.enquiryId`: Ties the qualified deal to the incoming customer enquiry.

## 3. UI Traceability Banner
The unified contract details view displays a "Source Traceability Banner" at the top of the workspace. This panel includes clickable links to:
*   Original Quotation with final contract value.
*   Verified Costing detailing the approved baseline margin.
*   Site Survey logs showing the surveyor’s risk assessment notes.
*   Audit history containing version diffs between draft and final active states.
