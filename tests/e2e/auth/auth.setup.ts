import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const authDir = path.resolve(__dirname, '../../../playwright/.auth');

setup('authenticate admin and security admin', async ({ browser }) => {
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const adminEmail = process.env.PW_ADMIN_EMAIL || 'admin@alhattab.qa';
  const adminPassword = process.env.PW_ADMIN_PASSWORD;

  if (!adminPassword) {
    throw new Error('E2E AUTH CONFIGURATION ERROR: PW_ADMIN_PASSWORD environment variable is not defined.');
  }

  const securityAdminEmail = process.env.PW_SECURITY_ADMIN_EMAIL || 'sarah.kim@alhattab.qa';
  const securityAdminPassword = process.env.PW_SECURITY_ADMIN_PASSWORD || adminPassword;

  if (!securityAdminPassword) {
    throw new Error('E2E AUTH CONFIGURATION ERROR: PW_SECURITY_ADMIN_PASSWORD environment variable is not defined.');
  }

  const baseURL = process.env.WEB_BASE_URL || 'http://localhost:3100';

  // 1. Authenticate ADMIN
  const context1 = await browser.newContext({ baseURL });
  const page1 = await context1.newPage();
  await page1.goto(`${baseURL}/login`);
  await page1.fill('input[type="email"]', adminEmail);
  await page1.fill('input[type="password"]', adminPassword);
  await page1.click('button[type="submit"]');

  await page1.waitForURL((url) => url.pathname === '/' || url.pathname === '/dashboard', { timeout: 15000 });
  await expect(page1).not.toHaveURL(/\/login/);

  const adminAuthPath = path.join(authDir, 'admin.json');
  await context1.storageState({ path: adminAuthPath });
  await context1.close();

  // 2. Authenticate SECURITY_ADMIN (Restricted Role)
  const context2 = await browser.newContext({ baseURL });
  const page2 = await context2.newPage();
  await page2.goto(`${baseURL}/login`);
  await page2.fill('input[type="email"]', securityAdminEmail);
  await page2.fill('input[type="password"]', securityAdminPassword);
  await page2.click('button[type="submit"]');

  await page2.waitForURL((url) => url.pathname === '/' || url.pathname === '/dashboard', { timeout: 15000 });
  await expect(page2).not.toHaveURL(/\/login/);

  const secAdminAuthPath = path.join(authDir, 'security-admin.json');
  await context2.storageState({ path: secAdminAuthPath });
  await context2.close();
});
