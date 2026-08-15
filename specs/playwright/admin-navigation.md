# Playwright Test Plan — PW-1 Authentication, RBAC & Navigation

**Target Application**: AHH WFM Web Application (`http://localhost:3100`)  
**Seed Specification**: `tests/e2e/seed.spec.ts`  
**Primary Role**: `ADMIN`  
**Restricted Role**: `SECURITY_ADMIN`  

---

## 1. ADMIN Comprehensive Navigation Suite

### 1.1 Dashboard Navigation & Layout Verification
- **Seed**: `tests/e2e/seed.spec.ts`
- **Steps**:
  1. Authenticate as `ADMIN` via `auth-setup` storage state.
  2. Navigate to `http://localhost:3100/`.
  3. Verify header brand link `AHH WFM` is visible and accessible.
  4. Verify sidebar navigation menu is visible.

### 1.2 Sidebar Module Route Verification
- **Seed**: `tests/e2e/seed.spec.ts`
- **Steps**:
  1. Navigate to `/workforce` and verify Workforce Directory page title and table container exist.
  2. Navigate to `/manpower/security-guarding/dashboard` and verify Security Guarding sub-dashboard loads.
  3. Navigate to `/manpower/facility-management/dashboard` and verify Facility Management sub-dashboard loads.
  4. Navigate to `/commercial/dashboard` and verify Commercial & Contracts hub loads.
  5. Navigate to `/attendance` and verify Attendance Monitor loads.
  6. Navigate to `/leave` and verify Leave Management loads.
  7. Navigate to `/clearance` and verify Clearance Management loads.
  8. Navigate to `/reports` and verify Reports Hub loads.
  9. Navigate to `/shifts` and verify Shift Master loads.
  10. Navigate to `/settings/masters` and verify Master Data Hub loads.
  11. Navigate to `/settings` and verify Settings console loads.

---

## 2. Authentication Lifecycle

### 2.1 Login, Logout, and Fresh Session Re-Entry
- **Steps**:
  1. Open `/login`.
  2. Enter `PW_ADMIN_EMAIL` and `PW_ADMIN_PASSWORD`. Click "Sign In".
  3. Confirm redirect to `/` or `/dashboard` and header user badge is visible.
  4. Click "Sign Out" icon in header.
  5. Confirm redirect to `/login`.
  6. Attempt to access `/workforce` directly in fresh unauthenticated page context and confirm redirect back to `/login`.

---

## 3. Role-Based Access Control (RBAC) & Navigation Filtering

### 3.1 Restricted Role Menu Filtering (`SECURITY_ADMIN`)
- **Steps**:
  1. Authenticate as `SECURITY_ADMIN` using `playwright/.auth/security-admin.json`.
  2. Navigate to `http://localhost:3100/`.
  3. Verify Security Guarding menu options are visible in navigation.
  4. Verify non-permitted admin settings links are hidden from navigation bar.

### 3.2 Direct URL Access & Protection
- **Steps**:
  1. As `ADMIN`, navigate directly to authorized route `/settings/masters` and confirm access granted.
  2. As `SECURITY_ADMIN`, navigate directly to restricted route `/admin/users` or `/settings/masters`.
  3. Verify direct URL denial or redirect to authorized landing page.
