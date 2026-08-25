# AHH WFM COMMERCIAL UAT
# SECURITY GUARDING — TESTER 1 — DEVELOPER / UAT LEAD + WORKFLOW CONFIGURATION
# Version 3.0 | Date: 2026-08-11 | Branch: manpower-operations-scope

---

## ⚠️ IMPORTANT: NO PASSWORDS OR CREDENTIALS ARE INCLUDED IN THIS SCRIPT
## Login credentials must be provided separately by the CIO / System Administrator.

---

# DO NOT START TEST UNTIL ALL ITEMS ARE YES

| Prerequisite | Status |
| --- | --- |
| SERVER Web accessible | YES/NO |
| Tester login available | YES/NO |
| Commercial Creator assigned | YES/NO |
| Required Approver assigned | YES/NO |
| Operations user assigned | YES/NO |
| HR user assigned | YES/NO |
| Finance user assigned | YES/NO |
| SITE SURVEY workflow ready | YES/NO |
| COSTING workflow ready | YES/NO |
| PROPOSAL workflow ready | YES/NO |
| COMMERCIAL_HANDOVER workflow ready if applicable | YES/NO |
| COMMERCIAL_ADDENDUM workflow ready | YES/NO |
| CONTRACT_RENEWAL workflow ready | YES/NO |
| Commercial reminder worker operational | YES/NO |
| Tester 1 dataset reserved | YES/NO |
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
| UAT Prefix | `UAT-SG-T1-20260811` |
| Script | PRIMARY END-TO-END HAPPY PATH |

---

# SECTION 0 — UAT ENVIRONMENT & WORKFLOW CONFIGURATION

**TO BE EXECUTED BY TESTER 1 — DEVELOPER / UAT LEAD**

**Purpose:** Prepare the central workflow configuration needed for both Tester 1 and Tester 2 UAT scenarios. This setup must occur through `Settings > Workflow Setup` only. No database writes. No source-code edits. No hardcoded workflow configuration.

**ADMIN LOGIN CREDENTIAL TO BE PROVIDED SEPARATELY**
*(For SECTION 0 only, Tester 1 may use an authorized ADMIN account because Workflow Setup is an administrative activity. After workflow configuration is complete, Tester 1 must switch to the appropriate normal business/UAT account for lifecycle testing.)*

### T1-SG-WF-001 — Review Current Workflow Setup
**Screen:** `Settings > Workflow Setup`
**Actions:** Inspect and record current status for SITE_SURVEY, COSTING, PROPOSAL, COMMERCIAL_HANDOVER, COMMERCIAL_ADDENDUM, CONTRACT_RENEWAL (moduleType, workflow/template name, Active, approval levels, approver assignment, RETURN, REJECT, current status).
**Expected Evidence:** Screenshot of Workflow Setup before changes.
**Screenshot:** `T1-SG-WF-001-WORKFLOW-INVENTORY.png`

### T1-SG-WF-002 — Configure Site Survey Workflow
**Actions:** Configure SITE_SURVEY (Active = YES, Level 1 approval, approver role/user, RETURN enabled where engine supports it, REJECT enabled where engine supports it, SoD according to current Workflow Setup capabilities).
**Expected Result:** Site Survey submission can create a WorkflowInstance. RETURN / approve actions are available according to configured permissions.
**Screenshot:** `T1-SG-WF-002-SITE-SURVEY-WORKFLOW.png`

### T1-SG-WF-003 — Configure Costing Workflow
**Actions:** Configure COSTING (Active = YES, Level 1 approval, approver role/user, RETURN enabled, REJECT enabled).
**Expected Result:** CL-3 Costing can be submitted for centralized workflow approval.
**Screenshot:** `T1-SG-WF-003-COSTING-WORKFLOW.png`

### T1-SG-WF-004 — Configure Proposal Workflow
**Actions:** Configure PROPOSAL (Active = YES, Level 1 approval, approver role/user, RETURN enabled, REJECT enabled).
**Expected Result:** CL-4 Proposal internal approval uses Workflow Setup. Client Acceptance remains separate and must NOT be configured as Proposal approval.
**Screenshot:** `T1-SG-WF-004-PROPOSAL-WORKFLOW.png`

### T1-SG-WF-005 — Verify / Configure Commercial Handover Workflow
**Actions:** Inspect actual behavior first. If Tester 1 wants handover approval tested during UAT: configure COMMERCIAL_HANDOVER (Active = YES, Level 1 approval, approver role/user, RETURN / REJECT where supported). If current CL-6 path legitimately permits direct handover when no workflow is configured, clearly document that behavior.
**Screenshot:** `T1-SG-WF-005-HANDOVER-WORKFLOW.png`

### T1-SG-WF-006 — Complete COMMERCIAL_ADDENDUM Workflow
**Actions:** Edit the existing active COMMERCIAL_ADDENDUM workflow. Add Level 1, appropriate approver, RETURN, REJECT where supported.
**Expected Result:** CL-7 submission no longer returns WORKFLOW_CONFIGURATION_REQUIRED_BEFORE_SUBMISSION.
**Screenshot:** `T1-SG-WF-006-ADDENDUM-WORKFLOW.png`

### T1-SG-WF-007 — Configure CONTRACT_RENEWAL Workflow
**Actions:** Configure CONTRACT_RENEWAL (Active = YES, Level 1 approval, approver role/user, RETURN enabled, REJECT where supported).
**Expected Result:** CL-8 renewal submission can enter WorkflowInstance. Direct decision bypass remains blocked.
**Screenshot:** `T1-SG-WF-007-RENEWAL-WORKFLOW.png`

### WORKFLOW APPROVER USERS (To be filled during Section 0)

| Workflow | Creator User | Approver User | App Role | Workflow Level | Ready |
| -------- | ------------ | ------------- | -------- | -------------- | ----- |
| SITE_SURVEY | | | | | |
| COSTING | | | | | |
| PROPOSAL | | | | | |
| COMMERCIAL_HANDOVER | | | | | |
| COMMERCIAL_ADDENDUM | | | | | |
| CONTRACT_RENEWAL | | | | | |

*(If a required user does not exist: Tester 1 must STOP that workflow setup step and record: `BLOCKED — UAT APPROVER USER ASSIGNMENT REQUIRED`)*

### T1-SG-WF-008 — Workflow Setup Smoke Test
**Actions:** Use a safe isolated UAT record. Test at least one configured workflow end to end:
1. **Creator:** create, submit. `LOG OUT / SWITCH USER`
2. **Approver:** open workflow, RETURN. `LOG OUT / SWITCH USER`
3. **Creator:** correct, resubmit. `LOG OUT / SWITCH USER`
4. **Approver:** approve.
**Verify:** WorkflowInstance, current step, WorkflowActionHistory, RETURN history, final approval history, SoD.
**Screenshot:** `T1-SG-WF-008-SMOKE-TEST.png`

### T1-SG-WF-009 — Release Tester 2 for UAT

| Workflow            | Ready                                     |
| ------------------- | ----------------------------------------- |
| Site Survey         | YES/NO                                    |
| Costing             | YES/NO                                    |
| Proposal            | YES/NO                                    |
| Commercial Handover | YES/NO / N/A according to chosen UAT path |
| Commercial Addendum | YES/NO                                    |
| Contract Renewal    | YES/NO                                    |

Confirm: creator account available (YES/NO), approver account available (YES/NO), role segregation verified (YES/NO), SERVER Web accessible (YES/NO), Commercial reminder worker online (YES/NO).

**Result:** `TESTER 2 RELEASED FOR UAT` (or `TESTER 2 UAT BLOCKED` if any item is NO).

---

## 1. TEST DATA REGISTER

| Item | Value | Source |
|---|---|---|
| **Client** | Qatar Petroleum | EXISTING LOCAL MASTER (ID: MC-001) |
| **Project** | QP HQ Security | EXISTING LOCAL MASTER (ID: MPROJ-001) |
| **Site** | QP Tower A | EXISTING LOCAL MASTER (ID: MSITE-001) |
| **Category 1** | Security Guard (Code: GUARD) | EXISTING LOCAL MASTER |
| **Category 2** | Security Supervisor (Code: SEC_SUPERVISOR) | EXISTING LOCAL MASTER |
| **Category 3** | CCTV Operator (Code: CCTV) | EXISTING LOCAL MASTER |
| **Opportunity / Enquiry**| UAT-SG-T1-20260811-OPP | UAT RECORD TO CREATE |
| **Survey** | UAT-SG-T1-20260811-SURVEY | UAT RECORD TO CREATE |
| **Cost Estimate** | UAT-SG-T1-20260811-COST | UAT RECORD TO CREATE |
| **Proposal** | UAT-SG-T1-20260811-PROPOSAL | UAT RECORD TO CREATE |
| **Contract Number** | UAT-SG-T1-CON-20260811 | UAT RECORD TO CREATE |
| **Addendum Reference** | UAT-SG-T1-ADD-20260811 | UAT RECORD TO CREATE |
| **Renewal Reference** | UAT-SG-T1-REN-20260811 | UAT RECORD TO CREATE |

---

## 2. SECURITY GUARDING CATEGORY REGISTER — TESTER 1

| Category Name | Code | T1 Qty | Shift | Hours/Day | Weekly Days | Reliever |
|---|---|---|---|---|---|---|
| Security Guard | GUARD | 10 | Morning (06:00–18:00) | 12 | 6 days on, 1 off | Yes |
| Security Supervisor | SEC_SUPERVISOR | 2 | Morning (06:00–18:00) | 12 | 6 days on, 1 off | Yes |
| CCTV Operator | CCTV | 2 | Morning (06:00–18:00) | 12 | 5 days on, 2 off | Yes |
| **Total Manpower** | | **14** | | | | |

**Deployment Type:** `SITE`
**Site:** QP Tower A
**Currency:** QAR | **Billing Basis:** MONTHLY

---

## 3. COST CALCULATION REGISTER — TESTER 1

### Manpower Salary Costs (UAT EXAMPLE INPUT)

| Category | Qty | Basic (QAR/mo) | Food (QAR/mo) | Transport (QAR/mo) | Accomm (QAR/mo) | Monthly/Person | Monthly Line Total |
|---|---|---|---|---|---|---|---|
| Security Guard | 10 | 1,800 | 300 | 250 | 400 | 2,750 | 27,500 |
| Security Supervisor | 2 | 2,400 | 300 | 250 | 400 | 3,350 | 6,700 |
| CCTV Operator | 2 | 2,000 | 300 | 250 | 400 | 2,950 | 5,900 |
| **Subtotal Manpower**| **14**| | | | | | **40,100** |

### Direct Costs (UAT EXAMPLE INPUT - Monthly Basis)

| Cost Component | Qty | Unit | Unit Cost (QAR) | Monthly Total (QAR) |
|---|---|---|---|---|
| Uniform | 14 | Per person | 150 | 2,100 |
| Safety Shoes | 14 | Per person | 100 | 1,400 |
| Torch / Equipment | 12 | Units | 50 | 600 |
| Radio/Communication| 4 | Units | 200 | 800 |
| Recruitment | 14 | Per person | 200 | 2,800 |
| Training | 14 | Per person | 150 | 2,100 |
| **Subtotal Direct**| | | | **9,800** |

### MONTHLY COSTING UAT VALUE

*(Use this label ONLY if the Costing screen explicitly represents a monthly cost period.)*

| Line | Value (QAR/month) |
|---|---|
| Total Cost | 49,900 |
| Overhead (10%) | 4,990 |
| Margin (15%) | 8,234 |
| **MONTHLY SELLING PRICE**| **~63,124** |

### PROPOSAL SELLING PRICE

*(As per system UI semantics. Not labeled monthly/annual unless UI specifies).*
**Value:** ~QAR 63,124

### EXPLICIT UAT FULL-TERM CONTRACT VALUE

**Value:** **QAR 130,000**
*CIO-DEFINED EXPLICIT UAT FULL-TERM CONTRACT VALUE. This value is entered independently for the complete Contract term and is NOT calculated from Costing monthly values, Proposal sellingPrice, or any assumed billing period.*

### EXPLICIT FULL-TERM COMMERCIAL IMPACT DELTA (For Addendum)

**Value:** **QAR 5,500**

---

## 4. CONTRACT TERM FOR CL-8 TESTING

**Start Date:** `2026-08-01`
**End Date:** `2026-09-30`
**Notice Period Days:** `60`

**CL-8 Eligibility Test (Mathematical Verification):**
- End Date: 2026-09-30
- Minus 60 Days Notice = `2026-08-01` (Renewal Review Start Date)
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

## TEST STEP T1-001: Log Client Email
**USER:** Commercial Creator
**URL:** `http://10.10.50.24:3200/commercial/activities`
**ACTIONS:**
1. Click **New Activity**. Type: **EMAIL**, Direction: **OUTBOUND**.
2. Subject: `UAT-SG-T1-20260811-EMAIL-REQ`. Client: **Qatar Petroleum**.
3. External Provider: `OUTLOOK`. External Item ID: `MSG-UAT-T1-20260811-001`.
4. Outlook Link: `https://outlook.office.com/mail/UAT-T1-MSG-001`.
5. Click Save. (Verify UI shows Outlook configuration-pending gracefully).
**EXPECTED:** Saved successfully. `T1-SG-CL1-001-EMAIL.png`
**RESULT:** PASS/FAIL

## TEST STEP T1-002: Log Client Call & Meeting
**USER:** Commercial Creator
**ACTIONS:**
1. Log Activity -> Type: **CALL**, Subject: `UAT-SG-T1-20260811-CALL`. Save.
2. Log Activity -> Type: **MEETING**, Subject: `UAT-SG-T1-20260811-MEETING`, Client: Qatar Petroleum. Save.
**EXPECTED:** Both records visible in Activities feed. `T1-SG-CL1-002-CALL-MTG.png`
**RESULT:** PASS/FAIL

## TEST STEP T1-003: Task Reminder Auto-Execution
**USER:** Commercial Creator
**ACTIONS:**
1. Click **New Task**. Title: `UAT-SG-T1-20260811-TASK`.
2. Set Due Date: 2026-08-15.
3. Set **Reminder At**: [Set to 3 minutes from now]. Note the time.
4. Save the task. Navigate away from Activities (e.g., to `/commercial`).
5. Do NOT keep refreshing Activities. Wait until reminder time passes.
6. Open Notification Center (bell icon). Confirm ONE reminder notification exists.
7. Wait another 2 minutes. Confirm NO duplicate appears.
**EXPECTED:** Reminder notification delivered without page refresh. No duplicates. `T1-SG-CL1-003-REMINDER.png`
**RESULT:** PASS/FAIL

## TEST STEP T1-004: Create Opportunity
**USER:** Commercial Creator
**URL:** `http://10.10.50.24:3200/commercial/crm`
**ACTIONS:**
1. Click **New Enquiry** / **Opportunity**. Opportunity Name: `UAT-SG-T1-20260811-OPP`.
2. Client: **Qatar Petroleum**. Site: **QP Tower A**. Headcount: 14. Save.
**EXPECTED:** Opportunity created in OPEN status. `T1-SG-CL1-004-OPP.png`
**RESULT:** PASS/FAIL

---

# PHASE: CL-2 — Site Surveys & Audits

## TEST STEP T1-005: Create & Submit Site Survey
**USER:** Commercial Creator
**URL:** `http://10.10.50.24:3200/commercial/surveys`
**ACTIONS:**
1. Click **New Survey**. Reference: `UAT-SG-T1-20260811-SURVEY`.
2. Client: **Qatar Petroleum**, Site: **QP Tower A**.
3. Manpower: 10 Guards, 2 Supervisors, 2 CCTV.
4. Save as Draft. Click **Submit for Approval**.
**EXPECTED:** Status is SUBMITTED/PENDING. `T1-SG-CL2-005-SURVEY-SUBMIT.png`
**RESULT:** PASS/FAIL

## TEST STEP T1-006: Approve Site Survey
**USER:** **LOG OUT / SWITCH USER** to `Survey Approver`
**URL:** `http://10.10.50.24:3200/commercial/surveys`
**ACTIONS:**
1. Open survey `UAT-SG-T1-20260811-SURVEY`.
2. Click **Approve**.
**EXPECTED:** Survey status is APPROVED. `T1-SG-CL2-006-SURVEY-APPROVE.png`
**RESULT:** PASS/FAIL

---

# PHASE: CL-3 — Transactional Costing

## TEST STEP T1-007: Create & Submit Costing
**USER:** **LOG OUT / SWITCH USER** to `Commercial Creator`
**URL:** `http://10.10.50.24:3200/commercial/costing`
**ACTIONS:**
1. Click **New Cost Estimate**. Title: `UAT-SG-T1-20260811-COST`.
2. Enter manpower and direct costs from Section 3.
3. Save as Draft. Click **Submit for Approval**.
**EXPECTED:** Submitted successfully. `T1-SG-CL3-007-COSTING-SUBMIT.png`
**RESULT:** PASS/FAIL

## TEST STEP T1-008: Approve Costing
**USER:** **LOG OUT / SWITCH USER** to `Costing Approver`
**URL:** `http://10.10.50.24:3200/commercial/costing`
**ACTIONS:**
1. Open Cost Estimate `UAT-SG-T1-20260811-COST`. Click **Approve**.
**EXPECTED:** Costing status is APPROVED. `T1-SG-CL3-008-COSTING-APPROVE.png`
**RESULT:** PASS/FAIL

---

# PHASE: CL-4 — Client Quotations / Proposal

## TEST STEP T1-009: Create & Submit Proposal
**USER:** **LOG OUT / SWITCH USER** to `Commercial Creator`
**URL:** `http://10.10.50.24:3200/commercial/proposals`
**ACTIONS:**
1. Click **New Quotation/Proposal**. Title: `UAT-SG-T1-20260811-PROPOSAL`.
2. Client: **Qatar Petroleum**. Site: **QP Tower A**.
3. Save as Draft. Click **Submit for Approval**.
**EXPECTED:** Submitted successfully. `T1-SG-CL4-009-PROP-SUBMIT.png`
**RESULT:** PASS/FAIL

## TEST STEP T1-010: Approve Proposal
**USER:** **LOG OUT / SWITCH USER** to `Proposal Approver`
**URL:** `http://10.10.50.24:3200/commercial/proposals`
**ACTIONS:**
1. Open Proposal `UAT-SG-T1-20260811-PROPOSAL`. Click **Approve**.
**EXPECTED:** Proposal status is APPROVED. `T1-SG-CL4-010-PROP-APPROVE.png`
**RESULT:** PASS/FAIL

---

# PHASE: CL-5 — Client Acceptance, Award & New Contract Conversion

## TEST STEP T1-011: Client Acceptance
**USER:** **LOG OUT / SWITCH USER** to `Commercial Creator`
**URL:** `http://10.10.50.24:3200/commercial/proposals`
**ACTIONS:**
1. Open Proposal `UAT-SG-T1-20260811-PROPOSAL`. Click **Issue to Client**.
2. Record Client Response: **ACCEPTED**.
**EXPECTED:** Proposal status is ACCEPTED. `T1-SG-CL5-011-PROP-ACCEPT.png`
**RESULT:** PASS/FAIL

## TEST STEP T1-012: Contract Conversion
**USER:** `Commercial Creator`
**URL:** `/commercial/contract-conversion/[id]` or from Proposal screen.
**ACTIONS:**
1. Click **Convert to Contract**. Contract Number: `UAT-SG-T1-CON-20260811`.
2. Set Start: `2026-08-01`, End: `2026-09-30`. Notice Period: `60` days.
3. Enter **EXPLICIT UAT FULL-TERM CONTRACT VALUE**: **QAR 130,000**.
4. Click Submit.
**EXPECTED:** Contract created in DRAFT. No auto-roster generated. `T1-SG-CL5-012-CONTRACT-DRAFT.png`
**RESULT:** PASS/FAIL

---

# PHASE: CL-6 — Operations Handover & Reports

## TEST STEP T1-013: Operations Handover
**USER:** **LOG OUT / SWITCH USER** to `Operations Handover` user.
**URL:** `http://10.10.50.24:3200/commercial/handover`
**ACTIONS:**
1. Locate contract `UAT-SG-T1-CON-20260811`.
2. Complete all checklist items (Operations briefing, HR, Finance, etc.).
3. Mark handover complete.
**EXPECTED:** Handover completed. No auto-roster generated. Contract becomes ACTIVE (depending on workflow/business logic). `T1-SG-CL6-013-HANDOVER.png`
**RESULT:** PASS/FAIL

---

# PHASE: CL-7 — Post-Award Contract Scope Amendments & Addendums

## TEST STEP T1-014: Addendum ADD Submission
**USER:** **LOG OUT / SWITCH USER** to `Commercial Creator`
**URL:** `http://10.10.50.24:3200/commercial/contracts`
**ACTIONS:**
1. Open ACTIVE contract `UAT-SG-T1-CON-20260811`.
2. Click **New Addendum**. Ref: `UAT-SG-T1-ADD-20260811`.
3. Type: **ADD**. Category: **Security Guard**.
4. Increase quantity from 10 to 12. Effective: `2026-08-20`.
5. Enter **EXPLICIT FULL-TERM COMMERCIAL IMPACT DELTA**: **QAR 5,500**.
6. Submit for Approval.
**EXPECTED:** Addendum status is SUBMITTED. `T1-SG-CL7-014-ADDENDUM-SUBMIT.png`
**RESULT:** PASS/FAIL

## TEST STEP T1-015: Addendum ADD Approval
**USER:** **LOG OUT / SWITCH USER** to `Addendum Approver`
**URL:** `http://10.10.50.24:3200/commercial/contracts`
**ACTIONS:**
1. Open Addendum `UAT-SG-T1-ADD-20260811`. Click **Approve**.
**EXPECTED:** Addendum APPROVED. Contract Guard quantity updated to 12. `T1-SG-CL7-015-ADDENDUM-APPROVE.png`
**RESULT:** PASS/FAIL

---

# PHASE: CL-8 — Contract Renewal & Expiry Management

## TEST STEP T1-016: Renewal Initiation & NEW_TERM
**USER:** **LOG OUT / SWITCH USER** to `Commercial Creator`
**URL:** `http://10.10.50.24:3200/commercial/renewals`
**ACTIONS:**
1. Locate `UAT-SG-T1-CON-20260811` in Expiring Contracts list (eligible due to UAT dates).
2. Click **Initiate Renewal**. Ref: `UAT-SG-T1-REN-20260811`.
3. Decision: **RENEW_NEW_TERM**.
4. New Start: `2026-10-01`, End: `2027-09-30`. Submit decision.
**EXPECTED:** Renewal case created. A new DRAFT contract is generated for the new term. Source contract remains ACTIVE. `T1-SG-CL8-016-RENEWAL.png`
**RESULT:** PASS/FAIL

---

# NEGATIVE TEST SECTION & ACTIVITY FEED

## TEST STEP T1-017: Activity Feed Verification
**USER:** `Commercial Creator`
**ACTIONS:**
1. Open contract `UAT-SG-T1-CON-20260811`. Check Activity Feed.
2. Verify all T1 actions appear chronologically (Renewal, Addendum, Handover, Conversion, Emails).
3. Ensure no Tester 2 records (`UAT-SG-T2`) appear here.
**EXPECTED:** Clean chronological feed. `T1-SG-NEG-017-FEED.png`
**RESULT:** PASS/FAIL

## TEST STEP T1-018: Duplicate Contract Number
**USER:** `Commercial Creator`
**ACTIONS:**
1. Attempt to create another contract named `UAT-SG-T1-CON-20260811`.
**EXPECTED:** Validation rejects duplicate safely. `T1-SG-NEG-018-DUP.png`
**RESULT:** PASS/FAIL

---

# DEFECT LOG — TESTER 1

| Defect ID | Date | Test Step | Screen | Expected | Actual | Severity |
|---|---|---|---|---|---|---|
| T1-DEF-001 | | | | | | |

---
*End of Tester 1 Script*
*Version 3.0 | 2026-08-11*
