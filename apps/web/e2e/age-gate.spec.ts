import { test, expect } from '@playwright/test';

/**
 * Entry age gate — single "I'm 21+" affirmation flow (#439).
 *
 * The DOB-entry UI was replaced with two CTAs:
 *   - "Yes, I'm 21 or older"  → sets `ageVerified=true` cookie, reveals site
 *   - "No, exit"              → redirects away (off-site)
 *
 * Real ID verification happens at checkout via AgeChecker.net. This gate
 * is friction-only and intentionally trivial to defeat.
 */

test.describe('Age Gate Affirmation UX', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies so the server renders the gate (no ageVerified cookie)
    await page.context().clearCookies();
    await page.goto('/');
    await page
      .locator('.age-gate-overlay')
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  test('displays the gate in isolation without nav or footer', async ({
    page,
  }) => {
    await expect(page.locator('.age-gate-overlay')).toBeVisible();
    await expect(page.locator('.age-gate-content')).toBeVisible();

    // Navigation must not be in the DOM — not just hidden
    await expect(page.locator('.header')).not.toBeAttached();

    // age-gate-screen is the full-viewport blocker
    const screen = page.locator('.age-gate-screen');
    const box = await screen.boundingBox();
    expect(box).toBeTruthy();
    const viewportSize = page.viewportSize();
    expect(box!.width).toBe(viewportSize!.width);
    expect(box!.height).toBe(viewportSize!.height);
  });

  test('ambient overlay portal is present during age gate', async ({
    page,
  }) => {
    const portal = page.locator('#ambient-portal');
    await expect(portal).toBeAttached();
  });

  test('renders both affirmation CTAs', async ({ page }) => {
    const affirm = page.getByRole('button', {
      name: /yes, i'?m 21 or older/i,
    });
    const deny = page.getByRole('button', { name: /no, exit/i });

    await expect(affirm).toBeVisible();
    await expect(affirm).toBeEnabled();
    await expect(deny).toBeVisible();
    await expect(deny).toBeEnabled();
  });

  test('displays disclaimer text', async ({ page }) => {
    const disclaimer = page.locator('.age-gate-disclaimer');
    await expect(disclaimer).toContainText(
      'By entering, you certify that you are of legal age to purchase cannabis'
    );
  });

  test('affirming reveals the site and persists the cookie', async ({
    page,
  }) => {
    const overlay = page.locator('.age-gate-overlay');
    const header = page.locator('.header');

    await page.getByRole('button', { name: /yes, i'?m 21 or older/i }).click();

    // Gate disappears, site shell renders
    await expect(overlay).not.toBeVisible();
    await expect(header).toBeVisible();

    // Cookie was written by the client
    const cookies = await page.context().cookies();
    const cookie = cookies.find(c => c.name === 'ageVerified');
    expect(cookie?.value).toBe('true');

    // Server respects the cookie on reload — gate doesn't re-render
    await page.reload();
    await expect(page.locator('.age-gate-overlay')).not.toBeVisible();
    await expect(header).toBeVisible();
  });

  test('denying redirects the visitor off-site', async ({ page }) => {
    // The deny button assigns to `window.location.href` and navigates away.
    // We intercept the outbound navigation rather than letting Playwright
    // chase a third-party host (which would be flaky in CI).
    await page.route('**/*', route => {
      const url = route.request().url();
      if (!url.startsWith('http://localhost')) {
        return route.fulfill({ status: 200, body: 'redirected' });
      }
      return route.continue();
    });

    const navigationPromise = page.waitForURL(
      url => !url.host.includes('localhost'),
      {
        timeout: 5000,
      }
    );

    await page.getByRole('button', { name: /no, exit/i }).click();
    await navigationPromise;

    // We should no longer be on the storefront
    expect(new URL(page.url()).host).not.toContain('localhost');

    // And the ageVerified cookie was NOT written
    const cookies = await page.context().cookies();
    expect(cookies.find(c => c.name === 'ageVerified')).toBeUndefined();
  });
});
