import { test, expect } from '@playwright/test';

test.describe('AHH WFM Mobile E2E Duty & Geofence Checks', () => {
  const email = process.env.E2E_EMAIL || 'admin@alhattab.qa';
  const password = process.env.E2E_PASSWORD || 'Password123!';

  test.use({ baseURL: process.env.MOBILE_BASE_URL || 'http://localhost:3101' });

  test('should load mobile dashboard and punch pages correctly', async ({ page }) => {
    // 1. Mobile app login page loads
    console.log('Mobile: Navigating to login...');
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);

    // 2. Mobile login works
    console.log('Mobile: Logging in...');
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', password);
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
    } else {
      await page.click('button');
    }

    // 3. Dashboard loads and current duty card is visible
    console.log('Mobile: Waiting for Dashboard...');
    await page.waitForURL(url => url.pathname === '/');
    expect(page.url()).toContain('/');
    
    const currentDutyHeader = page.locator('span:has-text("Current Duty")');
    await expect(currentDutyHeader).toBeVisible();

    // Ensure Guard Tour link is hidden for White Collar (admin)
    const guardTourLink = page.locator('a[href="/guard-tour"]');
    await expect(guardTourLink).not.toBeVisible();
    
    // 4. White Collar current duty shows default office when configured (e.g. Doha Headquarters)
    const dutyText = await page.locator('p.text-sm.font-bold.truncate').first().textContent();
    console.log('Resolved current duty:', dutyText);
    
    // Prasanth Panicker is the default seeded admin; he has Doha Headquarters as default office
    if (email === 'admin@alhattab.qa') {
      expect(dutyText).toContain('Doha Headquarters');
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
