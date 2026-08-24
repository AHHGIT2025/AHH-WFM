import { test, expect } from '@playwright/test';

test.describe('WFM Web E2E Navigation', () => {
  test('should load login page and navigate through all main modules', async ({ page }) => {
    const email = process.env.PW_ADMIN_EMAIL || 'admin@alhattab.qa';
    const password = process.env.PW_ADMIN_PASSWORD;

    if (!password) {
      throw new Error('PW_ADMIN_PASSWORD environment variable is not defined.');
    }

    // 1. Dashboard loads
    console.log('Navigating to Dashboard...');
    await page.goto('/');
    await expect(page).toHaveURL((url) => url.pathname === '/' || url.pathname === '/dashboard');
    await expect(page).not.toHaveURL(/\/login/);

    // 4. Workforce Directory loads
    console.log('Navigating to Workforce Directory...');
    await page.goto('/workforce');
    await expect(page).toHaveURL(/\/workforce/);

    // 5. SECFAC Center loads
    console.log('Navigating to SECFAC Center...');
    await page.goto('/secfac');
    await expect(page).toHaveURL(/\/secfac/);

    // 6. Commercial & Contracts loads
    console.log('Navigating to Commercial & Contracts...');
    await page.goto('/commercial');
    await expect(page).toHaveURL(/\/commercial/);

    // 7. Security Guarding Dashboard loads
    console.log('Navigating to Security Guarding Dashboard...');
    await page.goto('/manpower/security-guarding/dashboard');
    await expect(page).toHaveURL(/\/manpower\/security-guarding\/dashboard/);

    // 8. Facility Management Dashboard loads
    console.log('Navigating to Facility Management Dashboard...');
    await page.goto('/manpower/facility-management/dashboard');
    await expect(page).toHaveURL(/\/manpower\/facility-management\/dashboard/);

    // 9. Attendance page loads
    console.log('Navigating to Attendance Page...');
    await page.goto('/attendance');
    await expect(page).toHaveURL(/\/attendance/);

    // 10. Leave page loads
    console.log('Navigating to Leave Page...');
    await page.goto('/leave');
    await expect(page).toHaveURL(/\/leave/);

    // 11. Settings page loads
    console.log('Navigating to Settings Page...');
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);

    console.log('Web E2E Navigation completed successfully!');
  });
});
