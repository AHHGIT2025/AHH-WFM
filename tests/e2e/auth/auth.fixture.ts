import { test as base, Page } from '@playwright/test';
import path from 'path';

export interface AuthFixtures {
  adminPage: Page;
  securityAdminPage: Page;
}

export const authStoragePaths = {
  admin: path.resolve(__dirname, '../../../playwright/.auth/admin.json'),
  securityAdmin: path.resolve(__dirname, '../../../playwright/.auth/security-admin.json'),
};

export const test = base.extend<AuthFixtures>({
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: authStoragePaths.admin,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  securityAdminPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: authStoragePaths.securityAdmin,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
