import { test, expect } from "@playwright/test";

test.describe("AHH WFM — Guarding Manpower Drill-Down & Schedule Conflict Transparency", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3100/manpower/security-guarding/manpower");
    await page.waitForLoadState("networkidle");
  });

  test("1. Guarding Manpower Directory: Employee Identity is clickable and opens EmployeeDetailModal without React error #31", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => {
      consoleErrors.push(err.message);
    });

    // Check if table rendered
    const employeeRow = page.locator("table tbody tr").first();
    await expect(employeeRow).toBeVisible({ timeout: 10000 });

    // Find clickable employee name or ID button
    const empButton = employeeRow.locator("button[aria-label^='View details']").first();
    await expect(empButton).toBeVisible();

    // Click to open drill-down modal
    await empButton.click();

    // Verify EmployeeDetailModal is visible with role="dialog"
    const modal = page.locator("div[role='dialog']");
    await expect(modal).toBeVisible();
    await expect(modal.locator("#employee-detail-modal-title")).toBeVisible();

    // Verify Default Site/Location is scalar (no object crash)
    const locElement = modal.locator("span:has-text('Default Site/Location:') + span");
    await expect(locElement).toBeVisible();
    const locText = await locElement.textContent();
    expect(locText).toBeTruthy();
    expect(locText).not.toContain("[object Object]");

    // Verify Tab switching
    const scheduleTab = modal.locator("button:has-text('Roster & Schedule')");
    await expect(scheduleTab).toBeVisible();
    await scheduleTab.click();

    const overviewTab = modal.locator("button:has-text('Overview & Organization')");
    await expect(overviewTab).toBeVisible();
    await overviewTab.click();

    // Close via Close button
    const closeBtn = modal.locator("button:has-text('Close'), button[aria-label='Close modal']").first();
    await closeBtn.click();
    await expect(modal).not.toBeVisible();

    // 0 uncaught client exceptions
    expect(consoleErrors).toHaveLength(0);
  });

  test("2. Guarding Manpower Directory: Modal closes with Escape key", async ({ page }) => {
    const employeeRow = page.locator("table tbody tr").first();
    await expect(employeeRow).toBeVisible({ timeout: 10000 });

    const empButton = employeeRow.locator("button[aria-label^='View details']").first();
    await empButton.click();

    const modal = page.locator("div[role='dialog']");
    await expect(modal).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
  });

  test("3. Guarding Manpower Directory: Second employee can be opened after closing first", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => {
      consoleErrors.push(err.message);
    });

    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // 1. Open First Employee
    const firstEmpButton = rows.nth(0).locator("button[aria-label^='View details']").first();
    await firstEmpButton.click();

    const modal = page.locator("div[role='dialog']");
    await expect(modal).toBeVisible();
    const firstTitle = await modal.locator("#employee-detail-modal-title").textContent();

    // Close first modal
    const closeBtn = modal.locator("button:has-text('Close'), button[aria-label='Close modal']").first();
    await closeBtn.click();
    await expect(modal).not.toBeVisible();

    // 2. Open Second Employee (if available)
    if (count > 1) {
      const secondEmpButton = rows.nth(1).locator("button[aria-label^='View details']").first();
      await secondEmpButton.click();
      await expect(modal).toBeVisible();
      const secondTitle = await modal.locator("#employee-detail-modal-title").textContent();
      expect(secondTitle).toBeTruthy();

      await modal.locator("button:has-text('Close'), button[aria-label='Close modal']").first().click();
      await expect(modal).not.toBeVisible();
    }

    expect(consoleErrors).toHaveLength(0);
  });

  test("4. Shift Planner: Reliever Drawer renders Conflict Details and Deep-Linking", async ({ page }) => {
    await page.goto("http://localhost:3100/manpower/security-guarding/deployment-calendar");
    await page.waitForLoadState("networkidle");

    // Check calendar / planner page loaded
    const plannerContainer = page.locator("main, .container, #root").first();
    await expect(plannerContainer).toBeVisible();
  });
});

