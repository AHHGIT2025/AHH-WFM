import { test, expect } from '@playwright/test';

test.describe('Playwright Planner Seed Initialization @planner-seed', () => {
  test('ADMIN local authentication and dashboard readiness seed', async ({ page }) => {
    const adminEmail = process.env.PW_ADMIN_EMAIL || 'admin@alhattab.qa';
    const adminPassword = process.env.PW_ADMIN_PASSWORD;

    if (!adminPassword) {
      throw new Error('E2E SEED CONFIGURATION ERROR: PW_ADMIN_PASSWORD environment variable is not defined.');
    }

    const baseURL = page.context()._options.baseURL || 'http://localhost:3100';

    // 1. Open login page
    await page.goto(`${baseURL}/login`);

    // 2. Perform authentication
    await page.fill('input[type="email"]', adminEmail);
    await page.fill('input[type="password"]', adminPassword);
    await page.click('button[type="submit"]');

    // 3. Verify successful application entry
    await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/dashboard' || !url.pathname.includes('/login'), { timeout: 15000 });
    await expect(page).not.toHaveURL(/\/login/);

    // 4. Verify main layout/dashboard is ready using role-based locators
    await expect(page.getByRole('link', { name: /WFM/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Workforce Directory/i })).toBeVisible();

    // Seed state ready for Planner exploration
  });
});
