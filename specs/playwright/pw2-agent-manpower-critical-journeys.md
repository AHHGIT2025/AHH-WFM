# PW-2 Manpower Operations Critical User Journeys Test Specification Plan

## Application Overview

Autonomous agent-generated Playwright test plan covering Manpower Operations critical user journeys, including dashboard entry, requirement-slot scheduling, employee assignment, reliever eligibility validation, roster publication, period locking, operational closure, reconciliation & projection safety, RBAC, and company/operationType scope isolation.

## Test Scenarios

### 1. 1. Manpower Dashboard / Entry & Operational Navigation

**Seed:** `tests/e2e/seed.spec.ts`

#### 1.1. Authorized user can open Manpower Operations Hub and view operational controls

**File:** `tests/e2e/generated/pw2/manpower-dashboard-entry.spec.ts`

**Steps:**
  1. Navigate to "/manpower/security-guarding/dashboard"
    - expect: Security Guarding Operations Hub is visible
    - expect: Operational metrics cards are displayed
    - expect: Quick navigation links to Deployment Calendar and Reconciliation are present
  2. Navigate to "/manpower/facility-management/dashboard"
    - expect: Facility Management Operations Hub is visible
    - expect: Facility Management operational scope controls are displayed

### 2. 2. Requirement-Slot Scheduling & Master Roster Management

**Seed:** `tests/e2e/seed.spec.ts`

#### 2.1. Roster period selection and requirement slot visibility

**File:** `tests/e2e/generated/pw2/requirement-slot-scheduling.spec.ts`

**Steps:**
  1. Navigate to "/manpower/SECURITY_GUARDING/deployment-calendar"
    - expect: Deployment Calendar grid is rendered
    - expect: Roster requirement slots are visible
    - expect: Requirement slots display required trade/position and shift timings

### 3. 3. Employee Assignment & Conflict Rules

**Seed:** `tests/e2e/seed.spec.ts`

#### 3.1. Eligible employee assignment to requirement slot and conflict validation

**File:** `tests/e2e/generated/pw2/employee-assignment.spec.ts`

**Steps:**
  1. Select requirement slot on Deployment Calendar
    - expect: Slot assignment dialog or inline selector opens
    - expect: Eligible employees matching trade/position are listed
  2. Assign eligible employee to requirement slot
    - expect: Slot status updates to assigned
    - expect: Authoritative RosterSlotAssignment record is rendered

### 4. 4. Reliever Eligibility & Exception Workflow

**Seed:** `tests/e2e/seed.spec.ts`

#### 4.1. Reliever eligibility evaluation and replacement workflow

**File:** `tests/e2e/generated/pw2/reliever-eligibility.spec.ts`

**Steps:**
  1. Trigger reliever search for an absent or unassigned slot
    - expect: Reliever eligibility engine evaluates active status, work profile, and shift overlap
    - expect: Eligible relievers are displayed while ineligible/conflicting staff are blocked

### 5. 5. Roster Publication & Versioning Controls

**Seed:** `tests/e2e/seed.spec.ts`

#### 5.1. Draft roster publication and immutable versioning

**File:** `tests/e2e/generated/pw2/roster-publication.spec.ts`

**Steps:**
  1. View draft roster for operational period
    - expect: Draft status badge is displayed
    - expect: Publish Roster action button is enabled
  2. Execute roster publication
    - expect: Roster transitions to Published state
    - expect: Version sequence is incremented
    - expect: Published roster version becomes immutable

### 6. 6. Operational Period Locking & Lock Enforcement

**Seed:** `tests/e2e/seed.spec.ts`

#### 6.1. Period lock enforcement and unauthorized modification prevention

**File:** `tests/e2e/generated/pw2/period-locking.spec.ts`

**Steps:**
  1. Inspect locked operational period on deployment grid
    - expect: Lock indicator badge is visible
    - expect: Assignment edit/delete controls are disabled for non-admin users

### 7. 7. Operational Closure & Period Reconciliation

**Seed:** `tests/e2e/seed.spec.ts`

#### 7.1. Daily operational closure entry and closed state verification

**File:** `tests/e2e/generated/pw2/operational-closure.spec.ts`

**Steps:**
  1. Navigate to "/manpower/SECURITY_GUARDING/reconciliation"
    - expect: Operational closure and reconciliation table is rendered
    - expect: Shift completion and slot fulfillment status are displayed

### 8. 8. Reconciliation & Compatibility Projection Safety

**Seed:** `tests/e2e/seed.spec.ts`

#### 8.1. User-visible reconciliation effects and projection consistency

**File:** `tests/e2e/generated/pw2/reconciliation-projection-safety.spec.ts`

**Steps:**
  1. View shift projection status on reconciliation screen
    - expect: Authoritative RosterSlotAssignment matches projected deployment summary
    - expect: Discrepancy indicators highlight unmatched shifts cleanly

### 9. 9. Role-Based Access Control (RBAC) & Restricted Role Boundaries

**Seed:** `tests/e2e/seed.spec.ts`

#### 9.1. SECURITY_ADMIN role restriction to Security Guarding and denial of unauthorized Facility Management settings

**File:** `tests/e2e/generated/pw2/rbac-manpower-scope.spec.ts`

**Steps:**
  1. Authenticate as SECURITY_ADMIN (sarah.kim@alhattab.qa) and navigate to "/manpower/security-guarding/dashboard"
    - expect: Security Guarding dashboard is accessible
  2. Attempt direct URL navigation to "/manpower/facility-management/dashboard"
    - expect: Access Denied or restricted scope notification is displayed

### 10. 10. Company & Operation Scope Isolation

**Seed:** `tests/e2e/seed.spec.ts`

#### 10.1. OperationType scope isolation between SECURITY_GUARDING and FACILITY_MANAGEMENT

**File:** `tests/e2e/generated/pw2/company-operation-scope-isolation.spec.ts`

**Steps:**
  1. Navigate to Security Guarding deployment calendar
    - expect: Only SECURITY_GUARDING worksites, slots, and rosters are displayed
  2. Navigate to Facility Management deployment calendar
    - expect: Only FACILITY_MANAGEMENT worksites, slots, and rosters are displayed
