# Playwright E2E Test Plan: ADMIN & RBAC Navigation

**Plan Specification:** `specs/playwright/admin-navigation.md`  
**Seed Specification:** `tests/e2e/seed.spec.ts`  
**Author Agent:** `playwright_test_planner`  
**Target Application:** AHH WFM Web Application (`http://localhost:3100`)

---

## 1. ADMIN Navigation & Layout Verification
**Seed:** `tests/e2e/seed.spec.ts`

### 1.1 Dashboard Layout Visibility
**State:** Authenticated as `ADMIN` (`admin@alhattab.qa`)  
**Steps:**
1. Navigate to main dashboard (`/`)
2. Verify top header branding link "AHH WFM" is visible
3. Verify top navigation tab "Overview" is visible
4. Verify sidebar header "WFM Control Suite" is visible

### 1.2 Sidebar Navigation: Core Application Routes
**State:** Authenticated as `ADMIN` (`admin@alhattab.qa`)  
**Scenarios:**
- **1.2.1 Workforce Directory Navigation:** Click sidebar link "Workforce Directory" and verify URL `/workforce`.
- **1.2.2 Security Guarding Navigation:** Click sidebar link "Security Guarding" and verify URL `/manpower/security-guarding/dashboard`.
- **1.2.3 Facility Management Navigation:** Click sidebar link "Facility Management" and verify URL `/manpower/facility-management/dashboard`.
- **1.2.4 Commercial & Contracts Navigation:** Click sidebar link "Commercial & Contracts" and verify URL `/commercial/dashboard`.
- **1.2.5 Attendance Monitor Navigation:** Click sidebar link "Attendance Monitor" and verify URL `/attendance`.
- **1.2.6 Leave Management Navigation:** Click sidebar link "Leave Management" and verify URL `/leave`.
- **1.2.7 Clearance Management Navigation:** Click sidebar link "Clearance Management" and verify URL `/clearance`.
- **1.2.8 Reports Hub Navigation:** Click sidebar link "Reports Hub" and verify URL `/reports`.
- **1.2.9 Shift Master Navigation:** Click sidebar link "Shift Master" and verify URL `/shifts`.
- **1.2.10 Master Data Hub Navigation:** Click sidebar link "Master Data Hub" and verify URL `/settings/masters`.
- **1.2.11 Settings Navigation:** Click sidebar link "Settings" and verify URL `/settings`.

### 1.3 Direct URL Navigation for Authorized User
**State:** Authenticated as `ADMIN` (`admin@alhattab.qa`)  
**Steps:**
1. Navigate directly to URL `/settings/masters`
2. Verify URL is `/settings/masters`
3. Verify page header branding and layout shell render correctly

---

## 2. Authentication Lifecycle
**Seed:** Fresh browser context (no pre-existing session)  

### 2.1 Login, Logout, and Unauthenticated Protection
**State:** Unauthenticated  
**Steps:**
1. Navigate to `/login`
2. Fill email with `PW_ADMIN_EMAIL` and password with `PW_ADMIN_PASSWORD`
3. Submit credentials and verify redirect to `/` or `/dashboard`
4. Click sign out button (`button[title="Sign Out"]`)
5. Verify redirect to `/login`
6. Attempt direct URL access to `/workforce` and verify redirect to `/login`

---

## 3. Role-Based Access Control (RBAC) & Restricted Role Navigation
**Seed:** `playwright/.auth/security-admin.json`  

### 3.1 Restricted Role Menu Scope
**State:** Authenticated as `SECURITY_ADMIN` (`sarah.kim@alhattab.qa`)  
**Steps:**
1. Navigate to `/`
2. Verify accessible links (e.g. "Workforce Directory") are visible

### 3.2 Direct URL Denial for Unauthorized Routes
**State:** Authenticated as `SECURITY_ADMIN` (`sarah.kim@alhattab.qa`)  
**Steps:**
1. Navigate directly to restricted URL `/settings/masters`
2. Verify "Access Denied" header banner is displayed
