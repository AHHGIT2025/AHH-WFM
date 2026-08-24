import { test, expect } from '@playwright/test';

test.describe('WFM Mobile E2E Duty & Geofence Checks', () => {
  test('should load mobile dashboard and punch pages correctly', async ({ page }) => {
    const email = process.env.PW_ADMIN_EMAIL || 'admin@alhattab.qa';
    const password = process.env.PW_ADMIN_PASSWORD;

    if (!password) {
      throw new Error('PW_ADMIN_PASSWORD environment variable is not defined.');
    }

    console.log('Mobile: Navigating to login...');
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);

    // Fill login details
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // 2. Mobile Dashboard loads
    console.log('Mobile: Waiting for dashboard navigation...');
    await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/dashboard', { timeout: 15000 });
    await expect(page).not.toHaveURL(/\/login/);

    // 3. Check Mobile Dashboard elements
    console.log('Mobile: Verifying dashboard elements...');
    
    const currentDutyHeader = page.locator('span:has-text("Current Duty")');
    await expect(currentDutyHeader).toBeVisible();

    // Ensure Guard Tour link is hidden for White Collar (admin)
    const guardTourLink = page.locator('a[href="/guard-tour"]');
    await expect(guardTourLink).not.toBeVisible();
    
    // 4. White Collar current duty shows office or default message
    const dutyText = await page.locator('p.text-sm.font-bold.truncate').first().textContent();
    console.log('Resolved current duty:', dutyText);
    
    if (email === 'admin@alhattab.qa') {
      expect(dutyText).toMatch(/Doha Headquarters|Default Office Not Configured/);
    }

    // 5. Punch page loads
    console.log('Mobile: Navigating to Punch page...');
    await page.goto('/punch');
    await expect(page).toHaveURL(/\/punch/);

    // 6. Allowed punch location card should load, check that radius label formatting does not render empty
    const radiusText = await page.locator('body').textContent();
    if (radiusText && radiusText.includes('Radius:')) {
      expect(radiusText).not.toContain('Radius: m');
    }

    console.log('Mobile E2E checks completed successfully!');
  });
});
