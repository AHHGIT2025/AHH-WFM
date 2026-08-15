# ADMIN Navigation & Role Access Specification Plan

## Application Overview

Autonomous agent-generated Playwright test plan covering ADMIN sidebar navigation, layout verification, authentication lifecycle, and role-based access control (RBAC).

## Test Scenarios

### 1. ADMIN Navigation & Layout Verification

**Seed:** `tests/e2e/seed.spec.ts`

#### 1.1. Dashboard main layout elements are visible for ADMIN

**File:** `tests/e2e/generated/pw1/admin-dashboard-layout.spec.ts`

**Steps:**
  1. Navigate to "/" URL
    - expect: Header brand "AHH WFM" and Overview tab are visible
    - expect: Sidebar header "WFM Control Suite" is visible

#### 1.2. ADMIN sidebar navigation to /workforce

**File:** `tests/e2e/generated/pw1/admin-nav-workforce.spec.ts`

**Steps:**
  1. Click sidebar link "Workforce Directory"
    - expect: URL is "/workforce"
    - expect: Workforce Directory table or page container is visible

#### 1.3. ADMIN sidebar navigation to /manpower/security-guarding/dashboard

**File:** `tests/e2e/generated/pw1/admin-nav-security-guarding.spec.ts`

**Steps:**
  1. Click sidebar link "Security Guarding"
    - expect: URL is "/manpower/security-guarding/dashboard"
    - expect: Security Guarding operations hub is visible

#### 1.4. ADMIN sidebar navigation to /manpower/facility-management/dashboard

**File:** `tests/e2e/generated/pw1/admin-nav-facility-management.spec.ts`

**Steps:**
  1. Click sidebar link "Facility Management"
    - expect: URL is "/manpower/facility-management/dashboard"
    - expect: Facility Management operations hub is visible

#### 1.5. ADMIN sidebar navigation to /commercial/dashboard

**File:** `tests/e2e/generated/pw1/admin-nav-commercial.spec.ts`

**Steps:**
  1. Click sidebar link "Commercial & Contracts"
    - expect: URL is "/commercial/dashboard"
    - expect: Commercial command center dashboard is visible

#### 1.6. ADMIN sidebar navigation to /attendance

**File:** `tests/e2e/generated/pw1/admin-nav-attendance.spec.ts`

**Steps:**
  1. Click sidebar link "Attendance Monitor"
    - expect: URL is "/attendance"
    - expect: Attendance monitor view is visible

#### 1.7. ADMIN sidebar navigation to /leave

**File:** `tests/e2e/generated/pw1/admin-nav-leave.spec.ts`

**Steps:**
  1. Click sidebar link "Leave Management"
    - expect: URL is "/leave"
    - expect: Leave management dashboard is visible

#### 1.8. ADMIN sidebar navigation to /clearance

**File:** `tests/e2e/generated/pw1/admin-nav-clearance.spec.ts`

**Steps:**
  1. Click sidebar link "Clearance Management"
    - expect: URL is "/clearance"
    - expect: Clearance management view is visible

#### 1.9. ADMIN sidebar navigation to /reports

**File:** `tests/e2e/generated/pw1/admin-nav-reports.spec.ts`

**Steps:**
  1. Click sidebar link "Reports Hub"
    - expect: URL is "/reports"
    - expect: Reports hub container is visible

#### 1.10. ADMIN sidebar navigation to /shifts

**File:** `tests/e2e/generated/pw1/admin-nav-shifts.spec.ts`

**Steps:**
  1. Click sidebar link "Shift Master"
    - expect: URL is "/shifts"
    - expect: Shift master view is visible

#### 1.11. ADMIN sidebar navigation to /settings/masters

**File:** `tests/e2e/generated/pw1/admin-nav-settings-masters.spec.ts`

**Steps:**
  1. Click sidebar link "Master Data Hub"
    - expect: URL is "/settings/masters"
    - expect: Master data hub management view is visible

#### 1.12. ADMIN sidebar navigation to /settings

**File:** `tests/e2e/generated/pw1/admin-nav-settings.spec.ts`

**Steps:**
  1. Click sidebar link "Settings"
    - expect: URL is "/settings"
    - expect: Settings setup portal is visible

#### 1.13. Direct URL navigation for authorized ADMIN user

**File:** `tests/e2e/generated/pw1/admin-direct-url.spec.ts`

**Steps:**
  1. Navigate directly to "/settings/masters"
    - expect: URL is "/settings/masters"
    - expect: Page layout renders cleanly without error banner

### 2. Authentication Lifecycle

**Seed:** `tests/e2e/seed.spec.ts`

#### 2.1. Login, Logout, and unauthenticated redirect protection

**File:** `tests/e2e/generated/pw1/auth-lifecycle.spec.ts`

**Steps:**
  1. Navigate to "/login"
    - expect: Login form is displayed
  2. Fill credentials and submit
    - expect: Redirect to "/" dashboard
  3. Click sign out button
    - expect: Redirect to "/login"
  4. Attempt direct URL access to "/workforce"
    - expect: Redirect to "/login"

### 3. Role-Based Access Control (RBAC) & Restricted Role Navigation

**Seed:** `tests/e2e/seed.spec.ts`

#### 3.1. SECURITY_ADMIN menu filtering and navigation scope

**File:** `tests/e2e/generated/pw1/rbac-security-admin-menu.spec.ts`

**Steps:**
  1. Authenticate as SECURITY_ADMIN and navigate to "/"
    - expect: Workforce Directory is visible in sidebar
    - expect: Admin settings are filtered according to role

#### 3.2. SECURITY_ADMIN direct URL denial for unauthorized routes

**File:** `tests/e2e/generated/pw1/rbac-security-admin-denial.spec.ts`

**Steps:**
  1. Navigate directly to "/settings/masters"
    - expect: Access Denied banner is displayed
    - expect: Navigation to unauthorized master settings is blocked
