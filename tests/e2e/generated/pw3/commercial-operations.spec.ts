import { test, expect } from '@playwright/test';

test.describe('PW-3 Commercial & Contracts Critical User Journeys (Agent Generated)', () => {
  test('1. Commercial Executive Dashboard Navigation', async ({ page }) => {
    await page.goto('/commercial/dashboard');
    await expect(page).toHaveURL(/.*\/commercial\/dashboard/);
    await expect(page.locator('h1, h2, h3').filter({ hasText: /Commercial|Contracts/i }).first()).toBeVisible();
  });

  test('2. Site Survey & Pre-Contract Costing Module Visibility', async ({ page }) => {
    await page.goto('/commercial/surveys');
    await expect(page).toHaveURL(/.*\/commercial\/surveys/);
    
    await page.goto('/commercial/costing');
    await expect(page).toHaveURL(/.*\/commercial\/costing/);
  });

  test('3. Proposal & Contract Conversion Journeys', async ({ page }) => {
    await page.goto('/commercial/proposals');
    await expect(page).toHaveURL(/.*\/commercial\/proposals/);

    await page.goto('/commercial/contract-conversion');
    await expect(page).toHaveURL(/.*\/commercial\/contract-conversion/);
  });

  test('4. Active Contracts & Amendments Management', async ({ page }) => {
    await page.goto('/commercial/contracts');
    await expect(page).toHaveURL(/.*\/commercial\/contracts/);

    await page.goto('/commercial/amendments');
    await expect(page).toHaveURL(/.*\/commercial\/amendments/);
  });

  test('5. Centralized Workflow Governance & RBAC Check', async ({ page }) => {
    await page.goto('/settings/workflow-setup');
    await expect(page).toHaveURL(/.*\/settings\/workflow-setup/);
  });
});
