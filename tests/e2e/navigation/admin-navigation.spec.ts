// spec: specs/playwright/admin-navigation.md
// seed: tests/e2e/seed.spec.ts

import { test, expect } from '@playwright/test';
import path from 'path';

const secAdminAuthPath = path.resolve(__dirname, '../../../playwright/.auth/security-admin.json');

test.describe('ADMIN Navigation & Layout Verification', () => {
  test('Dashboard main layout elements are visible for ADMIN', async ({ page }) => {
    await page.goto('/');

    // Header logo & navigation
    await expect(page.getByRole('link', { name: /WFM/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Overview/i })).toBeVisible();

    // Sidebar Title
    await expect(page.getByText('WFM Control Suite')).toBeVisible();
  });

  const routes = [
    { name: /Workforce Directory/i, path: '/workforce' },
    { name: /Security Guarding/i, path: '/manpower/security-guarding/dashboard' },
    { name: /Facility Management/i, path: '/manpower/facility-management/dashboard' },
    { name: /Commercial & Contracts/i, path: '/commercial/dashboard' },
    { name: /Attendance Monitor/i, path: '/attendance' },
    { name: /Leave Management/i, path: '/leave' },
    { name: /Clearance Management/i, path: '/clearance' },
    { name: /Reports Hub/i, path: '/reports' },
    { name: /Shift Master/i, path: '/shifts' },
    { name: /Master Data Hub/i, path: '/settings/masters' },
    { name: /Settings/i, path: '/settings' },
  ];

  for (const route of routes) {
    test(`ADMIN sidebar navigation to ${route.path}`, async ({ page }) => {
      await page.goto('/');
      await page.waitForURL((url) => url.pathname === '/', { timeout: 10000 });
      const link = page.locator('aside nav').getByRole('link', { name: route.name });
      await expect(link).toBeVisible();
      await link.click();
      await page.waitForURL(new RegExp(route.path.replace(/\//g, '\\/')), { timeout: 15000 });
      expect(page.url()).toMatch(new RegExp(route.path.replace(/\//g, '\\/')));
    });
  }

  test('Direct URL navigation for authorized ADMIN user', async ({ page }) => {
    await page.goto('/settings/masters');
    await expect(page).toHaveURL(/\/settings\/masters/);
    await expect(page.getByRole('link', { name: /WFM/i }).first()).toBeVisible();
  });
});

test.describe('Authentication Lifecycle', () => {
  test('Login, Logout, and unauthenticated redirect protection', async ({ browser }) => {
    const adminEmail = process.env.PW_ADMIN_EMAIL || 'admin@alhattab.qa';
    const adminPassword = process.env.PW_ADMIN_PASSWORD;

    if (!adminPassword) {
      throw new Error('E2E TEST CONFIGURATION ERROR: PW_ADMIN_PASSWORD environment variable is required.');
    }

    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    // 1. Fresh login
    await page.goto('/login');
    await page.fill('input[type="email"]', adminEmail);
    await page.fill('input[type="password"]', adminPassword);
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/dashboard', { timeout: 15000 });
    await expect(page).not.toHaveURL(/\/login/);

    // 2. Sign Out using title locator
    const logoutButton = page.locator('button[title="Sign Out"]');
    await expect(logoutButton).toBeVisible();
    await logoutButton.click();

    await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);

    // 3. Direct unauthenticated access denial
    await page.goto('/workforce');
    await expect(page).toHaveURL(/\/login/);

    await context.close();
  });
});

test.describe('Role-Based Access Control (RBAC) & Restricted Role Navigation', () => {
  test('SECURITY_ADMIN menu filtering and navigation scope', async ({ browser }) => {
    const context = await browser.newContext({ storageState: secAdminAuthPath });
    const page = await context.newPage();

    await page.goto('/');

    // Dashboard and Workforce Directory are visible
    await expect(page.getByRole('link', { name: /Workforce Directory/i })).toBeVisible();

    await context.close();
  });

  test('SECURITY_ADMIN direct URL denial for unauthorized routes', async ({ browser }) => {
    const context = await browser.newContext({ storageState: secAdminAuthPath });
    const page = await context.newPage();

    // Attempting direct URL access to restricted Master Data Hub route
    await page.goto('/settings/masters');

    // Access Denied banner is displayed
    await expect(page.getByText('Access Denied')).toBeVisible();

    await context.close();
  });
});
