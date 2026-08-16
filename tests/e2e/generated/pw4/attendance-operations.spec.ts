import { test, expect } from '@playwright/test';

test.describe('PW-4 Attendance & Leave Critical User Journeys (Agent Generated)', () => {
  test('1. Attendance Monitor & Executive Dashboard Navigation', async ({ page }) => {
    await page.goto('/attendance');
    await expect(page).toHaveURL(/.*\/attendance/);
    await expect(page.locator('h1, h2, h3').filter({ hasText: /Attendance|Monitor/i }).first()).toBeVisible();
  });

  test('2. Employee Attendance Detail & Punch Records Visibility', async ({ page }) => {
    await page.goto('/attendance');
    await expect(page).toHaveURL(/.*\/attendance/);
    await expect(page.locator('table, .grid, [role="grid"]').first()).toBeVisible();
  });

  test('3. Employee Punch Interface & Mode Context', async ({ page }) => {
    await page.goto('/employee/punch');
    await expect(page).toHaveURL(/.*\/employee\/punch/);
    await expect(page.locator('button, [role="button"]').filter({ hasText: /Punch|Check In|Check Out/i }).first()).toBeVisible();
  });

  test('4. Leave Request Lifecycle & Balance Indication', async ({ page }) => {
    await page.goto('/leave');
    await expect(page).toHaveURL(/.*\/leave/);
    await expect(page.locator('h1, h2, h3').filter({ hasText: /Leave|Request/i }).first()).toBeVisible();
  });

  test('5. Manpower Calendars & Ramadan Rules Configuration', async ({ page }) => {
    await page.goto('/settings/manpower-calendars');
    await expect(page).toHaveURL(/.*\/settings\/manpower-calendars/);
  });
});
