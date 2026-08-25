# AHH WFM COMMERCIAL UAT
# SECURITY GUARDING — TESTER 2 — BUSINESS UAT TESTER
# Version 3.0 | Date: 2026-08-11 | Branch: manpower-operations-scope

---

## ⚠️ IMPORTANT: NO PASSWORDS OR CREDENTIALS ARE INCLUDED IN THIS SCRIPT
## Login credentials must be provided separately by the CIO / System Administrator.

---

# DO NOT START TEST UNTIL ALL ITEMS ARE YES

| Prerequisite | Status |
| --- | --- |
| Tester 1 Developer/UAT Lead has completed Section 0 — Workflow Configuration and has recorded TESTER 2 RELEASED FOR UAT | YES/NO |
| SERVER Web accessible | YES/NO |
| Tester login available | YES/NO |
| Commercial Creator assigned | YES/NO |
| Required Approver assigned | YES/NO |
| Operations user assigned | YES/NO |
| HR user assigned | YES/NO |
| Finance user assigned | YES/NO |
| Commercial reminder worker operational | YES/NO |
| Tester 2 dataset reserved | YES/NO |

**If any mandatory item is NO: DO NOT BEGIN FULL UAT**

---

## DOCUMENT SCOPE

| Field | Value |
|---|---|
| Operation | **SECURITY GUARDING ONLY** |
| Facility Management | **OUT OF SCOPE — DO NOT TEST** |
| SECFAC | **PAUSED — DO NOT TEST** |
| Outlook Live Graph | **NOT APPLICABLE — Pending Entra Approval** |
| Application URL (Web) | `http://10.10.50.24:3200` |
| Application URL (Mobile) | `http://10.10.50.24:3201` |
| Candidate Commit | `458cff1149fd55ba7d06c51ecaf8f36ba2aba4a3` |
| Server Deployment | **SERVER BASELINE DEPLOYED AND AVAILABLE FOR UAT** |
| UAT Prefix | `UAT-SG-T2-20260811` |
| Script | ALTERNATE / CONTROLLED EXCEPTION PATH |

---

## PRE-UAT PREREQUISITE CONFIRMATION

**Tester 1 Developer/UAT Lead has completed Section 0 — Workflow Configuration and has recorded TESTER 2 RELEASED FOR UAT.**

*(Tester 2 does NOT enter `Settings > Workflow Setup` except possibly read-only verification if authorized. Tester 2 should not alter templates, levels, approvers, moduleType assignments, or workflow configuration. Tester 2 is strictly a business-process tester.)*

---

## 1. TEST DATA REGISTER

| Item | Value | Source |
|---|---|---|
| **Client** | Qatar Petroleum | EXISTING LOCAL MASTER (ID: MC-001) |
| **Project (NEW)** | QP Ras Laffan Security | **CREATE NEW IN UI** (UAT-SG-T2-PROJ) |
| **Site (NEW)** | QP Ras Laffan Gate 1 | **CREATE NEW IN UI** (UAT-SG-T2-SITE) |
| **Category 1** | Security Guard (Code: GUARD) | EXISTING LOCAL MASTER |
| **Category 2** | Security Supervisor (Code: SEC_SUPERVISOR) | EXISTING LOCAL MASTER |
| **Category 3** | Patrolling Guard (Code: PATROL_GUARD) | EXISTING LOCAL MASTER |
| **Opportunity / Enquiry**| UAT-SG-T2-20260811-OPP | UAT RECORD TO CREATE |
| **Survey** | UAT-SG-T2-20260811-SURVEY | UAT RECORD TO CREATE |
| **Cost Estimate** | UAT-SG-T2-20260811-COST | UAT RECORD TO CREATE |
| **Proposal A (CHANGE)** | UAT-SG-T2-20260811-PROP-A | UAT RECORD TO CREATE |
| **Proposal B (ACCEPTED)**| UAT-SG-T2-20260811-PROP-B | UAT RECORD TO CREATE |
| **Contract Number** | UAT-SG-T2-CON-20260811 | UAT RECORD TO CREATE |
| **Addendum 1 (MODIFY)** | UAT-SG-T2-ADD-MOD-20260811 | UAT RECORD TO CREATE |
| **Addendum 2 (REMOVE)** | UAT-SG-T2-ADD-REM-20260811 | UAT RECORD TO CREATE |
| **Renewal (DECLINED)** | UAT-SG-T2-REN-DECL-20260811 | UAT RECORD TO CREATE |

*(Note: There is only one SECURITY_GUARDING client in the existing test database. We reuse Client MC-001 but create a separate Project and Site to ensure full isolation from Tester 1).*

---

## 2. SECURITY GUARDING CATEGORY REGISTER — TESTER 2

| Category Name | Code | T2 Qty | Shift | Hours/Day | Weekly Days | Reliever |
|---|---|---|---|---|---|---|
| Security Guard | GUARD | 15 | Morning (06:00–18:00) | 12 | 6 days on, 1 off | Yes |
| Security Supervisor | SEC_SUPERVISOR | 3 | Morning (06:00–18:00) | 12 | 6 days on, 1 off | Yes |
| Patrolling Guard | PATROL_GUARD | 2 | Night (18:00–06:00) | 12 | 5 days on, 2 off | Yes |
| **Total Manpower** | | **20** | | | | |

**Deployment Type:** `SITE`
**Site:** QP Ras Laffan Gate 1 (NEW)
**Currency:** QAR | **Billing Basis:** MONTHLY

---

## 3. COST CALCULATION REGISTER — TESTER 2

### Manpower Salary Costs (UAT EXAMPLE INPUT)

| Category | Qty | Basic (QAR/mo) | Food (QAR/mo) | Transport (QAR/mo) | Accomm (QAR/mo) | Monthly/Person | Monthly Line Total |
|---|---|---|---|---|---|---|---|
| Security Guard | 15 | 1,800 | 300 | 250 | 400 | 2,750 | 41,250 |
| Security Supervisor | 3 | 2,400 | 300 | 250 | 400 | 3,350 | 10,050 |
| Patrolling Guard | 2 | 1,900 | 300 | 250 | 400 | 2,850 | 5,700 |
| **Subtotal Manpower**| **20**| | | | | | **57,000** |

### Direct Costs (UAT EXAMPLE INPUT - Monthly Basis)

| Cost Component | Qty | Unit | Unit Cost (QAR) | Monthly Total (QAR) |
|---|---|---|---|---|
| Uniform | 20 | Per person | 150 | 3,000 |
| Safety Shoes | 20 | Per person | 100 | 2,000 |
| Torch / Equipment | 17 | Units | 50 | 850 |
| Radio/Communication| 5 | Units | 200 | 1,000 |
| Recruitment | 20 | Per person | 200 | 4,000 |
| Training | 20 | Per person | 150 | 3,000 |
| **Subtotal Direct**| | | | **13,850** |

### MONTHLY COSTING UAT VALUE

*(Use this label ONLY if the Costing screen explicitly represents a monthly cost period.)*

| Line | Value (QAR/month) |
|---|---|
| Total Cost | 70,850 |
| Overhead (10%) | 7,085 |
| Margin (15%) | 11,690 |
| **MONTHLY SELLING PRICE**| **~89,625** |

### PROPOSAL SELLING PRICE

*(As per system UI semantics. Not labeled monthly/annual unless UI specifies).*
**Value:** ~QAR 89,625

### EXPLICIT UAT FULL-TERM CONTRACT VALUE

**Value:** **QAR 185,000**
*CIO-DEFINED EXPLICIT UAT FULL-TERM CONTRACT VALUE. This value is entered independently for the complete Contract term and is NOT calculated from Costing monthly values, Proposal sellingPrice, or any assumed billing period.*

### EXPLICIT FULL-TERM COMMERCIAL IMPACT DELTA (For Addendum)

**Value:** **QAR 10,000**

---

## 4. CONTRACT TERM FOR CL-8 TESTING

**Start Date:** `2026-07-01`
**End Date:** `2026-08-31`
**Notice Period Days:** `60`

**CL-8 Eligibility Test (Mathematical Verification):**
- End Date: 2026-08-31
- Minus 60 Days Notice = `2026-07-02` (Renewal Review Start Date)
- Current UAT Date: `2026-08-11`
- **ELIGIBLE: YES** (UAT Date falls within the review window).

---

## PRE-TEST CHECK

**Step:** Open browser and navigate to the SERVER Web application.

| Check | Expected | Result |
|---|---|---|
| URL | `http://10.10.50.24:3200` | PASS / FAIL |
| Login prompt visible | Yes | PASS / FAIL |
| Login as Commercial Creator | Successful login | PASS / FAIL |

---

# PHASE: CL-1 — CRM & Opportunities / Planned Activities Gap Completion

## TEST STEP T2-001: Isolated Task Creation
**USER:** Commercial Creator
**URL:** `http://10.10.50.24:3200/commercial/activities`
**ACTIONS:**
1. Click **New Task**. Title: `UAT-SG-T2-20260811-TASK`.
2. Subject/Notes should uniquely identify T2.
3. Save task.
**EXPECTED:** Task created and does not conflict with Tester 1. `T2-SG-CL1-001-TASK.png`
**RESULT:** PASS/FAIL

---

# PHASE: CL-1 & CL-2 — CRM & Enquiry Intake (Create New Project & Site)

## TEST STEP T2-002: Create New Project & Site via Opportunity
**USER:** Commercial Creator
**URL:** `http://10.10.50.24:3200/commercial/crm`
**ACTIONS:**
1. Click **New Enquiry** / **Opportunity**. Opportunity Name: `UAT-SG-T2-20260811-OPP`.
2. Client: **Qatar Petroleum**.
3. Create New Project: **QP Ras Laffan Security** (UAT-SG-T2-PROJ).
4. Create New Site: **QP Ras Laffan Gate 1** (UAT-SG-T2-SITE).
5. Headcount: 20. Click Save.
**EXPECTED:** Opportunity created in OPEN status with the new Project and Site. `T2-SG-CL2-002-OPP.png`
**RESULT:** PASS/FAIL

---

# PHASE: CL-2 — Site Surveys & Audits (RETURN PATH)

## TEST STEP T2-003: Create & Submit Survey
**USER:** Commercial Creator
**URL:** `http://10.10.50.24:3200/commercial/surveys`
**ACTIONS:**
1. Click **New Survey**. Reference: `UAT-SG-T2-20260811-SURVEY`.
2. Client: **Qatar Petroleum**, Site: **QP Ras Laffan Gate 1**.
3. Save as Draft -> Click **Submit for Approval**.
**EXPECTED:** Status is SUBMITTED/PENDING. `T2-SG-CL2-003-SURVEY-SUBMIT.png`
**RESULT:** PASS/FAIL

## TEST STEP T2-004: Survey Approver RETURN
**USER:** **LOG OUT / SWITCH USER** to `Survey Approver`
**URL:** `http://10.10.50.24:3200/commercial/surveys`
**ACTIONS:**
1. Open Survey. Click **Return for Revision**. Add comment: "Missing night risk details."
**EXPECTED:** Survey status is RETURNED. `T2-SG-CL2-004-SURVEY-RETURN.png`
**RESULT:** PASS/FAIL

## TEST STEP T2-005: Survey Resubmit & Approve
**USER:** **LOG OUT / SWITCH USER** to `Commercial Creator`
**URL:** `http://10.10.50.24:3200/commercial/surveys`
**ACTIONS:**
1. Open Survey. Add risk details. Click **Resubmit for Approval**.
**USER:** **LOG OUT / SWITCH USER** to `Survey Approver`
2. Open Survey. Click **Approve**.
**EXPECTED:** Full audit trail: DRAFT → SUBMITTED → RETURNED → RESUBMITTED → APPROVED. `T2-SG-CL2-005-SURVEY-APPROVE.png`
**RESULT:** PASS/FAIL

---

# PHASE: CL-3 — Transactional Costing

## TEST STEP T2-006: Create & Submit Costing
**USER:** **LOG OUT / SWITCH USER** to `Commercial Creator`
**URL:** `http://10.10.50.24:3200/commercial/costing`
**ACTIONS:**
1. Create Cost Estimate `UAT-SG-T2-20260811-COST`.
2. Verify MONTHLY COSTING UAT VALUE equals ~QAR 89,625.
3. Click **Submit for Approval**.
**EXPECTED:** Costing status is SUBMITTED. `T2-SG-CL3-006-COST-SUBMIT.png`
**RESULT:** PASS/FAIL

## TEST STEP T2-007: Approve Costing
**USER:** **LOG OUT / SWITCH USER** to `Costing Approver`
**ACTIONS:**
1. Open Cost Estimate and click **Approve**.
**EXPECTED:** Costing status is APPROVED. `T2-SG-CL3-007-COST-APPROVE.png`
**RESULT:** PASS/FAIL

---

# PHASE: CL-4 — Client Quotations / Proposal (CHANGE_REQUESTED PATH)

## TEST STEP T2-008: Proposal A - Change Requested
**USER:** **LOG OUT / SWITCH USER** to `Commercial Creator`
**URL:** `http://10.10.50.24:3200/commercial/proposals`
**ACTIONS:**
1. Create Proposal A: `UAT-SG-T2-20260811-PROP-A`. Submit.
**USER:** **LOG OUT / SWITCH USER** to `Proposal Approver`
2. Approve Proposal A.
**USER:** **LOG OUT / SWITCH USER** to `Commercial Creator`
3. Issue to Client. Record Response: **CHANGE_REQUESTED**. Note: "Client wants 1 patrol guard instead of 2."
**EXPECTED:** Proposal A terminal. Cannot be converted to contract. `T2-SG-CL4-008-PROP-A.png`
**RESULT:** PASS/FAIL

## TEST STEP T2-009: Proposal B - Accepted
**USER:** `Commercial Creator`
**ACTIONS:**
1. Create Proposal B: `UAT-SG-T2-20260811-PROP-B`. Adjust cost if needed. Submit.
**USER:** **LOG OUT / SWITCH USER** to `Proposal Approver`
2. Approve Proposal B.
**USER:** **LOG OUT / SWITCH USER** to `Commercial Creator`
3. Issue to Client. Record Response: **ACCEPTED**.
**EXPECTED:** Proposal B ACCEPTED and ready for conversion. `T2-SG-CL4-009-PROP-B.png`
**RESULT:** PASS/FAIL

---

# PHASE: CL-5 — Client Acceptance, Award & New Contract Conversion

## TEST STEP T2-010: Convert Contract
**USER:** `Commercial Creator`
**URL:** `/commercial/contract-conversion/[id]`
**ACTIONS:**
1. Convert Proposal B. Contract Number: `UAT-SG-T2-CON-20260811`.
2. Start: `2026-07-01`, End: `2026-08-31`, Notice: `60` days.
3. **EXPLICIT UAT FULL-TERM CONTRACT VALUE**: **QAR 185,000**.
4. Submit conversion.
**EXPECTED:** DRAFT contract created. `T2-SG-CL5-010-CONVERT.png`
**RESULT:** PASS/FAIL

---

# PHASE: CL-6 — Operations Handover & Reports

## TEST STEP T2-011: Operations Handover
**USER:** **LOG OUT / SWITCH USER** to `Operations Handover` user
**URL:** `http://10.10.50.24:3200/commercial/handover`
**ACTIONS:**
1. Complete handover checklist for `UAT-SG-T2-CON-20260811`. Contract becomes ACTIVE.
**EXPECTED:** Handover completed. Contract ACTIVE. `T2-SG-CL6-011-HANDOVER.png`
**RESULT:** PASS/FAIL

---

# PHASE: CL-7 — Post-Award Contract Scope Amendments & Addendums

## TEST STEP T2-012: Addendum MODIFY & RETURN
**USER:** **LOG OUT / SWITCH USER** to `Commercial Creator`
**URL:** `http://10.10.50.24:3200/commercial/contracts`
**ACTIONS:**
1. New Addendum `UAT-SG-T2-ADD-MOD-20260811`. Type: **MODIFY**. Category: Security Guard.
2. Change Qty: 15 to 17. Submit.
**USER:** **LOG OUT / SWITCH USER** to `Addendum Approver`
3. **Return** the addendum (need effective date fixed).
**USER:** **LOG OUT / SWITCH USER** to `Commercial Creator`
4. Fix date, Resubmit.
**USER:** **LOG OUT / SWITCH USER** to `Addendum Approver`
5. **Approve**.
**EXPECTED:** Guard count updated to 17. `T2-SG-CL7-012-ADD-MODIFY.png`
**RESULT:** PASS/FAIL

## TEST STEP T2-013: Addendum REMOVE
**USER:** **LOG OUT / SWITCH USER** to `Commercial Creator`
**ACTIONS:**
1. New Addendum `UAT-SG-T2-ADD-REM-20260811`. Type: **REMOVE**. Category: Patrolling Guard. Change to 0.
2. Submit.
**USER:** **LOG OUT / SWITCH USER** to `Addendum Approver`
3. **Approve**.
**EXPECTED:** Patrolling guard removed from active contract. `T2-SG-CL7-013-ADD-REMOVE.png`
**RESULT:** PASS/FAIL

---

# PHASE: CL-8 — Contract Renewal & Expiry Management

## TEST STEP T2-014: Renewal DECLINED
**USER:** **LOG OUT / SWITCH USER** to `Commercial Creator`
**URL:** `http://10.10.50.24:3200/commercial/renewals`
**ACTIONS:**
1. Locate `UAT-SG-T2-CON-20260811` in Expiring Contracts list.
2. Initiate Renewal: `UAT-SG-T2-REN-DECL-20260811`.
3. Decision: **DECLINED** or **NOT_RENEWED**. Submit.
**EXPECTED:** Renewal case created as DECLINED. Contract remains ACTIVE/EXPIRING. No new draft contract is created. `T2-SG-CL8-014-RENEWAL-DECLINE.png`
**RESULT:** PASS/FAIL

---

# NEGATIVE TEST SECTION & ACTIVITY FEED

## TEST STEP T2-015: Activity Feed Verification
**USER:** `Commercial Creator`
**ACTIONS:**
1. Check Activity Feed on `UAT-SG-T2-CON-20260811`.
2. Verify all T2 actions appear. NO T1 actions appear.
**EXPECTED:** Clean chronological feed. `T2-SG-NEG-015-FEED.png`
**RESULT:** PASS/FAIL

---
*End of Tester 2 Script*
*Version 3.0 | 2026-08-11*
