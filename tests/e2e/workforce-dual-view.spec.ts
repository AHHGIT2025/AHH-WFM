import { test, expect } from '@playwright/test';

test.describe('Workforce Directory — Dual View (Tile & List View)', () => {
  test('1. Core View Toggle and LocalStorage Persistence Journey', async ({ page }) => {
    // Navigate to Workforce Directory
    await page.goto('/workforce');
    await expect(page).toHaveURL(/\/workforce/);
    await expect(page.getByRole('heading', { name: /Workforce Directory/i })).toBeVisible();

    // Verify toggle controls exist
    const tileToggle = page.getByRole('button', { name: 'Tile View' });
    const listToggle = page.getByRole('button', { name: 'List View' });

    await expect(tileToggle).toBeVisible();
    await expect(listToggle).toBeVisible();

    // Default view is Tile
    await expect(tileToggle).toHaveAttribute('aria-pressed', 'true');

    // Switch to List View
    await listToggle.click();
    await expect(listToggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('table')).toBeVisible();

    // Reload page -> List view remains persisted
    await page.reload();
    await expect(listToggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('table')).toBeVisible();

    // Switch to Tile View -> reload -> Tile view remains persisted
    await tileToggle.click();
    await expect(tileToggle).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(tileToggle).toHaveAttribute('aria-pressed', 'true');
  });

  test('2. Filter and Search Preservation Matrix across View Toggles', async ({ page }) => {
    await page.goto('/workforce');
    await expect(page).toHaveURL(/\/workforce/);

    const tileToggle = page.getByRole('button', { name: 'Tile View' });
    const listToggle = page.getByRole('button', { name: 'List View' });

    // Apply Search
    const searchInput = page.getByPlaceholder(/Search by name, ID or email/i);
    await searchInput.fill('Admin');
    await expect(searchInput).toHaveValue('Admin');

    // Switch to List -> verify search preserved
    await listToggle.click();
    await expect(searchInput).toHaveValue('Admin');
    await expect(page.locator('table')).toBeVisible();

    // Switch to Tile -> verify search preserved
    await tileToggle.click();
    await expect(searchInput).toHaveValue('Admin');

    // Clear search and test category filter
    await searchInput.fill('');
    const selects = page.locator('select');
    // Category filter is the 5th select
    const categorySelect = selects.nth(4);
    await categorySelect.selectOption('WHITE_COLLAR');
    await expect(categorySelect).toHaveValue('WHITE_COLLAR');

    // Switch to List -> verify category filter preserved
    await listToggle.click();
    await expect(categorySelect).toHaveValue('WHITE_COLLAR');

    // Switch to Tile -> verify category filter preserved
    await tileToggle.click();
    await expect(categorySelect).toHaveValue('WHITE_COLLAR');

    // Reset filters
    const resetBtn = page.getByRole('button', { name: /Reset Filters/i });
    if (await resetBtn.isVisible()) {
      await resetBtn.click();
    }
  });

  test('3. List View Columns, Data Rows, and Badges Verification', async ({ page }) => {
    await page.goto('/workforce');
    await expect(page).toHaveURL(/\/workforce/);

    const listToggle = page.getByRole('button', { name: 'List View' });
    await listToggle.click();
    await expect(listToggle).toHaveAttribute('aria-pressed', 'true');

    // Verify all 11 required columns in table header
    const table = page.locator('table');
    await expect(table).toBeVisible();
    await expect(table.locator('th', { hasText: 'Employee' }).first()).toBeVisible();
    await expect(table.locator('th', { hasText: 'Employee ID' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'Category' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'Company' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'Department' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'Trade / Position' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'Default Site' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'Employment Status' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'Duty Status' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'Contact' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'Actions' })).toBeVisible();

    // Verify at least one row rendered
    const rows = table.locator('tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('4. List View Edit and Delete Modal Workflows', async ({ page }) => {
    await page.goto('/workforce');
    await expect(page).toHaveURL(/\/workforce/);

    const listToggle = page.getByRole('button', { name: 'List View' });
    await listToggle.click();

    // 1. Edit Profile action
    const editButtons = page.locator('table tbody tr button', { hasText: 'Edit Profile' });
    if (await editButtons.count() > 0) {
      await editButtons.first().click();
      await expect(page.getByRole('heading', { name: /Edit Employee Profile/i })).toBeVisible();
      // Close modal
      const closeBtn = page.getByRole('button', { name: /Cancel|Close/i }).first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }

    // 2. Delete Employee action
    const deleteButtons = page.locator('table tbody tr button', { hasText: 'Delete Employee' });
    if (await deleteButtons.count() > 0) {
      await deleteButtons.first().click();
      await expect(page.getByRole('heading', { name: /Confirm Employee Deletion/i })).toBeVisible();
      await expect(page.getByText(/CRITICAL SECURITY NOTICE/i)).toBeVisible();
      // Safely Cancel without deleting
      const cancelBtn = page.getByRole('button', { name: /Cancel/i }).last();
      await cancelBtn.click();
      await expect(page.getByRole('heading', { name: /Confirm Employee Deletion/i })).not.toBeVisible();
    }
  });

  test('5. Empty State and Reset Filters in List View', async ({ page }) => {
    await page.goto('/workforce');
    await expect(page).toHaveURL(/\/workforce/);

    const listToggle = page.getByRole('button', { name: 'List View' });
    await listToggle.click();

    // Search for non-existent employee
    const searchInput = page.getByPlaceholder(/Search by name, ID or email/i);
    await searchInput.fill('XYZ_NON_EXISTENT_QUERY_999');

    // Empty state should be visible
    await expect(page.getByText('No employees match the selected filters')).toBeVisible();
    const resetBtn = page.getByRole('button', { name: 'Reset Filters' }).last();
    await expect(resetBtn).toBeVisible();

    // Click Reset Filters
    await resetBtn.click();
    await expect(searchInput).toHaveValue('');
    await expect(page.locator('table')).toBeVisible();
  });

  test('6. Responsive Medium Viewport and Table Scroll Layout', async ({ page }) => {
    // Test medium / tablet viewport width (768px)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/workforce');

    const listToggle = page.getByRole('button', { name: 'List View' });
    await expect(listToggle).toBeVisible();
    await listToggle.click();

    const table = page.locator('table');
    await expect(table).toBeVisible();
    // Verify overflow container is present
    const tableContainer = page.locator('div.overflow-x-auto');
    await expect(tableContainer).toBeVisible();
  });
});
