import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke suite for the main user journeys, run against the app's WEB export
 * (npm run e2e:build) with a deterministic fake backend (e2e/fixtures).
 * No accounts, no network, no production data. Native-only features (PDF
 * export, widgets, notifications, 3D performance) are NOT covered here -
 * see docs/DEVICE_QA.md.
 */
const port = Number(process.env.E2E_PORT ?? 4173);

export default defineConfig({
  testDir: './tests',
  outputDir: './.results',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { outputFolder: './.report', open: 'never' }]],
  use: {
    baseURL: `http://localhost:${port}`,
    ...devices['Pixel 7'],
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
    // A service worker could fetch around page/context routes - none may register.
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'node server.mjs',
    cwd: __dirname,
    port,
    reuseExistingServer: !process.env.CI,
  },
});
