import { test, expect } from '@playwright/test';

test.describe('AHH WFM Web E2E Navigation', () => {
  const email = process.env.E2E_EMAIL || 'admin@alhattab.qa';
  const password = process.env.E2E_PASSWORD || 'Password123!';

  test('should load login page and navigate through all main modules', async ({ page }) => {
    // 1. Login page loads
    console.log('Navigating to login page...');
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('input[type="email"]')).toBeVisible();

    // 2. Login using credentials
    console.log('Logging in...');
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', password);
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
    } else {
      await page.click('button');
    }

    // 3. Dashboard loads
    console.log('Waiting for Dashboard...');
    await page.waitForURL(url => url.pathname === '/' || url.pathname === '/dashboard');
    expect(page.url()).toContain('/');

    // 4. Workforce Directory loads
    console.log('Navigating to Workforce Directory...');
    await page.goto('/workforce');
    await expect(page).toHaveURL(/\/workforce/);

    // 5. Master Data Hub loads
    console.log('Navigating to Master Data Hub...');
    await page.goto('/settings/masters');
    await expect(page).toHaveURL(/\/settings\/masters/);

    // 6. Settings loads
    console.log('Navigating to Settings...');
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);

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
    
    console.log('All E2E web navigation routes loaded successfully!');
  });
});
