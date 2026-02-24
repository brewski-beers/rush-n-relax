import { Page } from '@playwright/test';

/**
 * Shared E2E Test Fixtures
 *
 * Common setup routines extracted to avoid redundancy across spec files.
 * Each helper targets a specific UX gate (age verification, auth, etc.)
 * and can be composed in any test that needs post-gate access.
 *
 * PATTERN: Tests should only verify the thing they're testing.
 *          Cross-cutting concerns (like age-gate) belong here.
 */

/** Default legal birthdate values for age verification bypass */
const LEGAL_DOB = {
  month: '01',
  day: '15',
  year: '1990',
};

/**
 * Completes age verification so tests can access post-gate pages.
 * Uses a fixed birthdate well over 21 to avoid edge-case failures.
 *
 * @param page - Playwright page instance (must already be navigated to '/')
 */
export async function verifyAge(page: Page): Promise<void> {
  const overlay = page.locator('.age-gate-overlay');

  // If already verified (localStorage persisted), skip
  const isVisible = await overlay.isVisible().catch(() => false);
  if (!isVisible) return;

  await page.locator('input[id="month"]').fill(LEGAL_DOB.month);
  await page.locator('input[id="day"]').fill(LEGAL_DOB.day);
  await page.locator('input[id="year"]').fill(LEGAL_DOB.year);
  await page.locator('button[type="submit"]').click();

  // Wait for gate to close — targeted check, not networkidle
  await overlay.waitFor({ state: 'hidden', timeout: 3000 });
}

/**
 * Sets age verification directly in localStorage before navigation.
 * Fastest path — skips the UI entirely. Use when age-gate isn't under test.
 *
 * @param page - Playwright page instance (call BEFORE page.goto)
 */
export async function preVerifyAge(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('ageVerified', 'true');
  });
}
