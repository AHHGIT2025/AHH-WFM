# Client & Site Ownership Specification

This document defines the promotions and constraints governing client and site records as they transition from pre-contract prospects to active operational assets.

## 1. Client Promotion Lifecycle
1.  **Prospect Client Creation**: Initiated in CRM during enquiry stage under `PreContractProspectClient` (Sales owned).
2.  **Promotion Trigger**: Legal and Finance approve the quotation and trigger Contract creation.
3.  **Promotion Actions**: WFM promotes `PreContractProspectClient` to a master `Client` record:
    *   Generates a master Client ID.
    *   Duplicates and maps tax registry details and primary contact records.
    *   Sets status to `ACTIVE`.

## 2. Site Promotion Lifecycle
1.  **Prospective Site Creation**: Created in the pre-contract survey request under prospective site details (Operations owned).
2.  **Site Survey Conducted**: Risks and guard post coordinates are logged against this prospective site.
3.  **Promotion Trigger**: Contract Activation.
4.  **Promotion Actions**: WFM promotes the prospective site details to the master `Site` table:
    *   Creates a permanent operational Site ID.
    *   Finalizes coordinates, zones, and safety parameters.
    *   Binds the master Site to the activated `ManpowerContract`.

## 3. Preservation Policies
*   Under no circumstances should master Client or Site records be overwritten by pre-contract data.
*   Pre-contract records remain archived as historical references for audit and margin comparison purposes.
