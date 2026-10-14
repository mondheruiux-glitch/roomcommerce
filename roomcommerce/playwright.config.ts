// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45 * 1000, // 45s global test timeout (covers async generation)
  expect: { timeout: 10 * 1000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'Desktop Firefox',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'Mobile Safari (iPhone 15)',
      use: { ...devices['iPhone 15'] },
    },
  ],
  webServer: [
    ...(process.env.CI || process.env.RUN_API_SERVER
      ? [
          {
            command: 'MODAL_MOCK_MODE=true pnpm --filter @roomcommerce/api dev',
            url: 'http://localhost:4000/api/v1/health',
            reuseExistingServer: true,
            timeout: 60 * 1000,
            env: {
              PORT: '4000',
              MODAL_MOCK_MODE: 'true',
            },
          },
        ]
      : []),
    {
      command: 'pnpm --filter @roomcommerce/web dev',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 60 * 1000,
      env: {
        PORT: '3000',
      },
    },
  ],
});
