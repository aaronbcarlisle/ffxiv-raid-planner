import { defineConfig } from '@playwright/test';

const frontendUrl = process.env.E2E_FRONTEND_URL || 'http://localhost:5174';

/**
 * Playwright E2E configuration for FFXIV Raid Planner.
 *
 * Prerequisites:
 *   1. Backend running on E2E_API_URL or http://localhost:8001 with DEV_AUTH_MODE=true
 *   2. Frontend running on E2E_FRONTEND_URL or http://localhost:5174
 *
 * Run:
 *   pnpm test:e2e            # headless
 *   pnpm test:e2e -- --ui    # interactive UI mode
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,          // tests share DB state via dev-auth
  retries: 0,
  workers: 1,                    // sequential to avoid session collisions
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: frontendUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 1440, height: 900 },
      },
    },
  ],

  /* Do NOT start dev servers automatically — the user manages them via dev.ps1 */
});
