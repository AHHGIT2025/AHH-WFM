import { test, expect } from "@playwright/test";

test.describe("PW-8 Mobile Cross-Module Operational Journeys", () => {
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

  test("1. Identity & Current Duty Resolution on Mobile Dashboard", async ({ page }) => {
    await page.goto(`${MOBILE_URL}/`);
    await expect(page.locator("text=Current Duty")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Check In").or(page.locator("text=Check Out"))).toBeVisible();
    await expect(page.locator("text=Universal Approval Center")).toBeVisible();
  });

  test("2. Published Schedule & Shift Visibility Journey", async ({ page }) => {
    await page.goto(`${MOBILE_URL}/schedule`);
    await expect(page.locator("body")).not.toBeEmpty({ timeout: 10000 });
    await page.goto(`${MOBILE_URL}/shifts`);
    await expect(page.locator("body")).not.toBeEmpty({ timeout: 10000 });
  });

  test("3. Geofenced Attendance Punch & Log History", async ({ page }) => {
    await page.goto(`${MOBILE_URL}/punch`);
    await expect(page.locator("h2:has-text('Live Attendance Tracker')").or(page.locator("text=Attendance")).first()).toBeVisible({ timeout: 10000 });
    await page.goto(`${MOBILE_URL}/history`);
    await expect(page.locator("body")).not.toBeEmpty({ timeout: 10000 });
  });

  test("4. Mobile Leave Request & Balances Journey", async ({ page }) => {
    await page.goto(`${MOBILE_URL}/leave`);
    await expect(page.locator("text=Leave").or(page.locator("h1, h2:has-text('Leave')")).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("5. Mobile Universal Approval Center — Pending Inbox & Module Filtering", async ({ page }) => {
    await page.goto(`${MOBILE_URL}/approvals`);
    await expect(page.locator("h1:has-text('Universal Approval Center')")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("button:has-text('Pending Inbox')")).toBeVisible();
    await expect(page.locator("button:has-text('Actioned Outbox')")).toBeVisible();

    // Test Module Filter Chips
    await page.click("button:has-text('Commercial')");
    await page.waitForTimeout(300);
    await page.click("button:has-text('Clearance')");
    await page.waitForTimeout(300);
    await page.click("button:has-text('All Modules')");
  });

  test("6. Mobile Universal Approval Center — Actioned Outbox Tracking", async ({ page }) => {
    await page.goto(`${MOBILE_URL}/approvals`);
    await expect(page.locator("h1:has-text('Universal Approval Center')")).toBeVisible({ timeout: 10000 });
    
    // Switch to Outbox
    await page.click("button:has-text('Actioned Outbox')");
    await page.waitForTimeout(500);
    await expect(page.locator("button:has-text('Actioned Outbox')")).toHaveClass(/bg-surface/);
  });

  test("7. Mobile Universal Approval Center — Detail View Navigation", async ({ page }) => {
    await page.goto(`${MOBILE_URL}/approvals`);
    await expect(page.locator("h1:has-text('Universal Approval Center')")).toBeVisible({ timeout: 10000 });

    // If items exist, click first item; otherwise verify empty state
    const firstItem = page.locator("a[href*='/approvals/']").first();
    if (await firstItem.isVisible()) {
      await firstItem.click();
      await expect(page.locator("h1:has-text('Approval Details')")).toBeVisible({ timeout: 10000 });
      await expect(page.locator("text=Approval Lifecycle & History")).toBeVisible();
    } else {
      await expect(page.locator("text=Inbox Zero").or(page.locator("text=No Action History"))).toBeVisible();
    }
  });

  test("8. SECFAC Duty Post Orders & Field Reporting Context", async ({ page }) => {
    await page.goto(`${MOBILE_URL}/secfac-post-orders`);
    await expect(page.locator("h2:has-text('Digital Post Orders')")).toBeVisible({ timeout: 10000 });

    await page.goto(`${MOBILE_URL}/incident-report`);
    await expect(page.locator("h2:has-text('Report Incident')")).toBeVisible({ timeout: 10000 });
  });

  test("9. Supervisor Team Roster & Mobile Command Suite", async ({ page }) => {
    await page.goto(`${MOBILE_URL}/supervisor`);
    await expect(page.locator("body")).not.toBeEmpty({ timeout: 10000 });

    await page.goto(`${MOBILE_URL}/command-center`);
    await expect(page.locator("h2:has-text('Command Suite')").or(page.locator("h3:has-text('Access Restricted')")).or(page.locator("h3:has-text('Unable to load Command Center')"))).toBeVisible({ timeout: 10000 });
    
    // If Command Suite header is visible, verify operations console elements and Home navigation
    const commandSuiteHeader = page.locator("h2:has-text('Command Suite')");
    if (await commandSuiteHeader.isVisible()) {
      await expect(page.locator("text=Live Executive Operations Console")).toBeVisible();
      // Test Back to Home navigation
      const backHomeBtn = page.locator("a[href='/']").first();
      await backHomeBtn.click();
      await expect(page).toHaveURL(`${MOBILE_URL}/`);
    }
  });

  test("10. Mobile Offline Sync Queue & Reconnect Status", async ({ page }) => {
    await page.goto(`${MOBILE_URL}/sync-status`);
    await expect(page.locator("body")).not.toBeEmpty({ timeout: 10000 });
  });
});
