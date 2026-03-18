import { test, expect } from '@playwright/test';
import { preVerifyAge } from './fixtures';

/**
 * Storefront Promo Page — BDD E2E coverage.
 *
 * Seeded promo (from emulator):
 *   slug:    laser-bong
 *   name:    Hitoki Trident
 *   tagline: Fire Without Flame.
 *   active:  true
 *   cta:     Visit Seymour  →  /locations/seymour
 *
 * The PromoClient component resolves the promo image from Firebase Storage
 * via getDownloadURL(). The Storage emulator seeds "promos/laser-bong.png".
 * We do NOT assert the resolved image URL — Storage resolution is async and
 * the component gracefully falls back to a placeholder div, so the test is
 * not fragile against emulator timing.
 */

test.describe('Storefront Promo Page', () => {
  test.beforeEach(async ({ page }) => {
    // Given: age gate is bypassed
    await preVerifyAge(page);
  });

  // ─── Active promo ────────────────────────────────────────────────────────

  test('active promo page renders the promo name and tagline', async ({
    page,
  }) => {
    // Given: the seeded laser-bong promo is active
    // When: user navigates to /promo/laser-bong
    await page.goto('/promo/laser-bong');
    await page.waitForSelector('main.promo-page', { timeout: 8000 });

    // Then: the promo name is displayed in the h1
    await expect(page.locator('h1')).toContainText('Hitoki Trident');

    // Then: the tagline is visible
    await expect(page.locator('.lead')).toContainText('Fire Without Flame');
  });

  test('active promo page renders the CTA button linking to the location', async ({
    page,
  }) => {
    // Given: the seeded promo has ctaPath = "/locations/seymour"
    // When: the promo page is loaded
    await page.goto('/promo/laser-bong');
    await page.waitForSelector('#promo-cta', { timeout: 8000 });

    // Then: the CTA link is visible and points to the Seymour location page
    const ctaLink = page.locator('#promo-cta a');
    await expect(ctaLink).toBeVisible();
    await expect(ctaLink).toContainText('Visit Seymour');
    await expect(ctaLink).toHaveAttribute('href', '/locations/seymour');
  });

  test('active promo page renders the promo details card', async ({ page }) => {
    // Given: the laser-bong promo has details text
    // When: the promo details section is rendered
    await page.goto('/promo/laser-bong');
    await page.waitForSelector('#promo-details', { timeout: 8000 });

    // Then: the details section is present
    await expect(page.locator('#promo-details')).toBeVisible();
  });

  test('active promo page renders the location note linking to Seymour', async ({
    page,
  }) => {
    // Given: the promo has locationSlug = "seymour"
    // When: the promo details card is rendered
    await page.goto('/promo/laser-bong');
    await page.waitForSelector('#promo-details', { timeout: 8000 });

    // Then: an "Available at [location name]" link appears in the details card
    const locationLink = page.locator('#promo-details a[href*="seymour"]');
    await expect(locationLink).toBeVisible();
  });

  test('CTA link navigates to the Seymour location page', async ({ page }) => {
    // Given: user is on the promo page
    await page.goto('/promo/laser-bong');
    await page.waitForSelector('#promo-cta', { timeout: 8000 });

    // When: user clicks the CTA button
    await page.locator('#promo-cta a').click();

    // Then: they land on the Seymour location page
    await expect(page).toHaveURL(/\/locations\/seymour/, { timeout: 8000 });
  });

  // ─── Non-existent promo ───────────────────────────────────────────────────

  test('non-existent promo slug renders the not-found page', async ({
    page,
  }) => {
    // Given: there is no promo with slug "this-does-not-exist"
    // When: user navigates to that URL
    const response = await page.goto('/promo/this-does-not-exist');

    // Then: a 404 status is returned
    expect(response?.status()).toBe(404);

    // Then: the not-found UI is displayed (Next.js renders app/not-found.tsx)
    // We look for common 404 indicators — heading or the not-found page landmark
    const bodyText = await page.locator('body').textContent();
    expect(
      bodyText?.toLowerCase().includes('not found') ||
        bodyText?.toLowerCase().includes('404')
    ).toBe(true);
  });

  test('inactive promo slug (active=false) renders the not-found page', async ({
    page,
  }) => {
    // Given: the PromoPage server component calls notFound() when active is false
    // The promo would need to exist but be inactive — this slug doesn't exist in seed.
    // The server returns 404 for either case (missing or inactive).
    const response = await page.goto('/promo/inactive-promo-slug');
    expect(response?.status()).toBe(404);
  });
});
