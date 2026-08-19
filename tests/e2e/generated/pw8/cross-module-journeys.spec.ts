import { test, expect } from "@playwright/test";

test.describe("PW-8 Cross-Module Desktop Integration & Verification", () => {
  const WEB_URL = process.env.WEB_BASE_URL || "http://localhost:3100";

  test("1. Universal Approval Center Desktop Main Integration", async ({ page }) => {
    await page.goto(`${WEB_URL}/approvals`);
    await expect(page.locator("h1:has-text('Universal Approval Center')")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("button:has-text('Pending Review')").or(page.locator("button:has-text('Inbox')")).first()).toBeVisible();
    await expect(page.locator("button:has-text('Actioned History')").or(page.locator("button:has-text('Outbox')")).first()).toBeVisible();
  });

  test("2. Manpower Security Guarding & Facility Management Dashboards Cross-Check", async ({ page }) => {
    await page.goto(`${WEB_URL}/manpower/security-guarding/dashboard`);
    await expect(page.locator("h1, h2:has-text('Security Guarding')")).toBeVisible({ timeout: 10000 });

    await page.goto(`${WEB_URL}/manpower/facility-management/dashboard`);
    await expect(page.locator("h1, h2:has-text('Facility Management')")).toBeVisible({ timeout: 10000 });
  });

  test("3. Centralized Workflow Governance Path in Settings", async ({ page }) => {
    await page.goto(`${WEB_URL}/settings`);
    await expect(page.locator("h1, h2:has-text('Settings')")).toBeVisible({ timeout: 10000 });
  });

  test("4. SECFAC Operational Web Review Integration", async ({ page }) => {
    await page.goto(`${WEB_URL}/secfac`);
    await expect(page.locator("h1:has-text('SECFAC Command Center')")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("h3:has-text('Control Room')")).toBeVisible();
    await expect(page.locator("h3:has-text('Incident Review')")).toBeVisible();
  });
});
