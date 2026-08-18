import { test, expect } from "@playwright/test";

test.describe("PW-7 SECFAC Security Guarding Web Operations", () => {
  const WEB_URL = process.env.WEB_BASE_URL || "http://localhost:3100";

  test("1. SECFAC Command Center Grid & Navigation Links", async ({ page }) => {
    await page.goto(`${WEB_URL}/secfac`);
    await expect(page.locator("h1:has-text('SECFAC Command Center')")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("h3:has-text('Control Room')").first()).toBeVisible();
    await expect(page.locator("h3:has-text('Checkpoints Registry')").first()).toBeVisible();
    await expect(page.locator("h3:has-text('Checklist Builder')").first()).toBeVisible();
    await expect(page.locator("h3:has-text('Post Orders')").first()).toBeVisible();
    await expect(page.locator("h3:has-text('Shift Briefings')").first()).toBeVisible();
    await expect(page.locator("h3:has-text('Incident Review')").first()).toBeVisible();
    await expect(page.locator("h3:has-text('Supervisor Inspections')").first()).toBeVisible();
    await expect(page.locator("h3:has-text('SOS Alerts Center')").first()).toBeVisible();
    await expect(page.locator("h3:has-text('Compliance Reports')").first()).toBeVisible();
    await expect(page.locator("h3:has-text('Audit Trail')").first()).toBeVisible();
  });

  test("2. Digital Post Orders & Lineage Management", async ({ page }) => {
    await page.goto(`${WEB_URL}/secfac/post-orders`);
    await expect(page.locator("text=Digital Post Orders").or(page.locator("h1, h2, h3:has-text('Post Orders')")).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("3. Shift Briefings Management", async ({ page }) => {
    await page.goto(`${WEB_URL}/secfac/shift-briefings`);
    await expect(page.locator("text=Shift Briefings").or(page.locator("h1, h2, h3:has-text('Briefing')")).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("4. Incident & Occurrence Review and Management", async ({ page }) => {
    await page.goto(`${WEB_URL}/secfac/incidents`);
    await expect(page.locator("text=Incident").or(page.locator("h1, h2, h3:has-text('Incident')")).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("5. Supervisor Field Inspections Review", async ({ page }) => {
    await page.goto(`${WEB_URL}/secfac/supervisor-inspections`);
    await expect(page.locator("text=Supervisor Inspection").or(page.locator("h1, h2, h3:has-text('Inspection')")).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("6. Patrol Routes & Assurance Monitoring", async ({ page }) => {
    await page.goto(`${WEB_URL}/secfac/patrol-routes`);
    await expect(page.locator("text=Patrol").or(page.locator("h1, h2, h3:has-text('Patrol')")).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("7. Checkpoints Registry Management", async ({ page }) => {
    await page.goto(`${WEB_URL}/secfac/checkpoints`);
    await expect(page.locator("text=Checkpoint").or(page.locator("h1, h2, h3:has-text('Checkpoint')")).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("8. SOS Emergency Alerts Center", async ({ page }) => {
    await page.goto(`${WEB_URL}/secfac/sos-alerts`);
    await expect(page.locator("text=SOS").or(page.locator("h1, h2, h3:has-text('Alert')")).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("9. Lone Worker Welfare Checks Schedule", async ({ page }) => {
    await page.goto(`${WEB_URL}/secfac/welfare-checks`);
    await expect(page.locator("text=Welfare").or(page.locator("h1, h2, h3:has-text('Welfare')")).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("10. Checklist Template Builder", async ({ page }) => {
    await page.goto(`${WEB_URL}/secfac/checklist-builder`);
    await expect(page.locator("text=Checklist").or(page.locator("h1, h2, h3:has-text('Checklist')")).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("11. Immutable Audit Trail", async ({ page }) => {
    await page.goto(`${WEB_URL}/secfac/audit-trail`);
    await expect(page.locator("text=Audit").or(page.locator("h1, h2, h3:has-text('Audit')")).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("12. SECFAC Operational Reports", async ({ page }) => {
    await page.goto(`${WEB_URL}/secfac/reports`);
    await expect(page.locator("text=Report").or(page.locator("h1, h2, h3:has-text('Report')")).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("body")).not.toBeEmpty();
  });
});
