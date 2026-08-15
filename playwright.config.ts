import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env if present
dotenv.config({ path: path.resolve(__dirname, '.env') });

const WEB_BASE_URL = process.env.WEB_BASE_URL || 'http://localhost:3100';
const MOBILE_BASE_URL = process.env.MOBILE_BASE_URL || 'http://localhost:3101';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  use: {
    baseURL: WEB_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'auth-setup',
      testMatch: /.*\.setup\.ts/,
      testIgnore: ['**/seed.spec.ts'],
    },
    {
      name: 'planner-seed',
      testMatch: /seed\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: WEB_BASE_URL,
      },
      dependencies: ['auth-setup'],
    },
    {
      name: 'chromium',
      testIgnore: ['**/seed.spec.ts', '**/mobile/**', '**/*.setup.ts'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: WEB_BASE_URL,
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['auth-setup'],
    },
    {
      name: 'mobile-chrome',
      testMatch: ['**/mobile/**'],
      use: {
        ...devices['Pixel 5'],
        baseURL: MOBILE_BASE_URL,
      },
      dependencies: ['auth-setup'],
    },
  ],
  webServer: [
    {
      command: 'npm run dev:web',
      url: WEB_BASE_URL,
      reuseExistingServer: true,
      timeout: 120 * 1000,
    },
    {
      command: 'npm run dev:mobile',
      url: MOBILE_BASE_URL,
      reuseExistingServer: true,
      timeout: 120 * 1000,
    },
  ],
});
