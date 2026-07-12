import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Read from .env file if available
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const WEB_BASE_URL = process.env.WEB_BASE_URL || 'http://localhost:3100';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: 'playwright-report' }]],
  use: {
    baseURL: WEB_BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        baseURL: process.env.MOBILE_BASE_URL || 'http://localhost:3101',
      },
    },
  ],
});
