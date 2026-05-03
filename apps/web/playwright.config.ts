import { defineConfig, devices } from '@playwright/test';

/**
 * Test suite modes:
 * SMOKE: age-gate only (fastest, ~2-3min)
 * CORE: age-gate + user-journey + app (medium, ~8-10min)
 * FULL: all spec files, all browsers (default, ~15-20min+)
 */
const testMode = process.env.TEST_MODE || 'full';
const isCI = !!process.env.CI;
const isSmokeMode = testMode === 'smoke';
const isCoreMode = testMode === 'core';

// When set, Playwright targets an already-running server (preview channel or
// production URL) instead of spinning up a local dev server.
// Used by the smoke cron workflow: PLAYWRIGHT_BASE_URL=https://rushnrelax.com
const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

// Local: Chromium + Mobile (realistic but fast). CI: selective or all.
const projects = isCI
  ? isSmokeMode
    ? [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
    : isCoreMode
      ? [
          { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
          { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
        ]
      : [
          { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
          { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
          { name: 'webkit', use: { ...devices['Desktop Safari'] } },
          { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
          { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
        ]
  : [
      { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
      { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    ];

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: !isCI && !isSmokeMode,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? 'list' : 'html',

  use: {
    baseURL: externalBaseUrl || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects,

  // Only start a local dev server when not targeting an external URL.
  // Smoke cron sets PLAYWRIGHT_BASE_URL so no server is needed.
  ...(externalBaseUrl
    ? {}
    : {
        webServer: {
          command: 'pnpm dev',
          url: 'http://localhost:3000',
          reuseExistingServer: true,
          timeout: 30000,
          // Order-flow E2E (issue #285) needs:
          //   - AgeChecker simulate buttons (test-mode flag in modal)
          //   - Clover stub fallback (live-payments kill switch closed)
          //   - Webhook HMAC secret so POSTs to /api/webhooks/clover validate
          // Only set when not already provided by the caller's shell.
          env: {
            NEXT_PUBLIC_AGECHECKER_TEST_MODE:
              process.env.NEXT_PUBLIC_AGECHECKER_TEST_MODE ?? 'true',
            CLOVER_LIVE_PAYMENTS_ENABLED:
              process.env.CLOVER_LIVE_PAYMENTS_ENABLED ?? 'false',
            CLOVER_WEBHOOK_SECRET:
              process.env.CLOVER_WEBHOOK_SECRET ?? 'e2e-clover-secret',
          },
        },
      }),
});
