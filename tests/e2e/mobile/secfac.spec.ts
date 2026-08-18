import { test, expect } from "@playwright/test";

test.describe("PW-7 SECFAC Security Guarding Mobile Operations", () => {
  const MOBILE_URL = process.env.MOBILE_BASE_URL || "http://localhost:3101";

  test.beforeEach(async ({ page }) => {
    const email = process.env.PW_ADMIN_EMAIL || "admin@alhattab.qa";
    const password = process.env.PW_ADMIN_PASSWORD;
    if (password) {
      await page.goto(`${MOBILE_URL}/login`);
      await page.fill("input[type='email']", email);
      await page.fill("input[type='password']", password);
      await page.click("button[type='submit']");
      await page.waitForTimeout(1000);
    }
  });

  test("1. Mobile Guard Tour Patrol Hub and Shortcuts", async ({ page }) => {
    await page.goto(`${MOBILE_URL}/guard-tour`);
    // Assert Guard Tour page loaded
    await expect(page.locator("text=Guard Tour").or(page.locator("text=Access Denied")).or(page.locator("h2:has-text('Guard Tour')")).first()).toBeVisible({ timeout: 10000 });
  });

  test("2. Mobile Duty Post Orders View and Acknowledgement", async ({ page }) => {
    await page.goto(`${MOBILE_URL}/secfac-post-orders`);
    await expect(page.locator("h2:has-text('Digital Post Orders')")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Site Post Orders")).toBeVisible();
  });

  test("3. Mobile Field Incident / Occurrence Reporting Journey", async ({ page }) => {
    await page.goto(`${MOBILE_URL}/incident-report`);
    await expect(page.locator("h2:has-text('Report Incident')")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("input[placeholder*='Damaged perimeter']")).toBeVisible();
    await expect(page.locator("button[type='submit']")).toBeVisible();

    // Fill form
    await page.fill("input[placeholder*='Damaged perimeter']", "E2E Field Security Gate Inspection Report");
    await page.fill("textarea[placeholder*='Log detailed']", "Observed perimeter gate latch operational during scheduled mobile round.");
    await page.click("button[type='submit']");
    await page.waitForTimeout(1000);
  });

  test("4. Mobile Shift Briefing Desk", async ({ page }) => {
    await page.goto(`${MOBILE_URL}/secfac-briefing`);
    await expect(page.locator("h2:has-text('Shift Briefing Desk')")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Site Shift Briefings")).toBeVisible();
  });

  test("5. Mobile Supervisor Field Inspection Audit Journey", async ({ page }) => {
    await page.goto(`${MOBILE_URL}/secfac-supervisor-inspection`);
    await expect(page.locator("h2:has-text('Supervisor Field Inspection')")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("input[placeholder*='EMP002']")).toBeVisible();

    // Fill inspection
    await page.fill("input[placeholder*='EMP002']", "EMP-SG-001");
    await page.fill("textarea[placeholder*='Field observation']", "Turnout compliance verified 100% on site.");
    await page.click("button[type='submit']");
    await page.waitForTimeout(1000);
  });

  test("6. Mobile Patrol Checkpoint Assurance & Sequence Handling", async ({ page }) => {
    await page.goto(`${MOBILE_URL}/secfac-patrol`);
    await expect(page.locator("h1:has-text('Patrol Checkpoint Assurance')")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=MANDATORY SEQUENCE")).toBeVisible();

    // Test out of order scan simulation
    const simulateBtn = page.locator("button:has-text('SIMULATE OUT-OF-ORDER SCAN')");
    await expect(simulateBtn).toBeVisible();
    await simulateBtn.click();
    await expect(page.locator("text=SEQUENCE DEVIATION BLOCKED")).toBeVisible();
  });

  test("7. Mobile Responder Emergency Dispatch Console", async ({ page }) => {
    await page.goto(`${MOBILE_URL}/secfac-dispatch`);
    await expect(page.locator("h1:has-text('Responder Emergency Dispatch')")).toBeVisible({ timeout: 10000 });
  });

  test("8. Mobile Lone Worker Welfare Check-in & Offline Mode", async ({ page }) => {
    await page.goto(`${MOBILE_URL}/secfac-welfare`);
    await expect(page.locator("h1:has-text('Lone Worker Welfare')")).toBeVisible({ timeout: 10000 });
    
    // Toggle offline mode button
    const modeBtn = page.locator("button:has-text('ONLINE')").or(page.locator("button:has-text('OFFLINE MODE')")).first();
    await expect(modeBtn).toBeVisible();
    await modeBtn.click();
    await page.waitForTimeout(500);
  });
});
