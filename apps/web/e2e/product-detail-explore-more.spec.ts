import { test, expect } from '@playwright/test';
import { preVerifyAge } from './fixtures';

/**
 * Explore More — product detail related products section.
 *
 * Regression guard: only products with an online inventory record
 * (availableOnline: true at locationId 'online') should appear.
 * Products that exist in the catalog but are not online-visible must
 * never be shown here.
 *
 * Relies on seed fixtures:
 *   - blue-dream          → online, availableOnline: true  (anchor product)
 *   - blue-dream-distillate-cart → online record exists but availableOnline: false
 */
test.describe('Product Detail — Explore More', () => {
  test.beforeEach(async ({ page }) => {
    await preVerifyAge(page);
  });

  test('only online-visible products appear in Explore More', async ({
    page,
  }) => {
    await page.goto('/products/blue-dream');
    await page.waitForSelector('.related-products', { timeout: 8000 });

    const section = page.locator('.related-products');
    await expect(section).toBeVisible();

    // blue-dream-distillate-cart has availableOnline: false — must not appear
    await expect(
      section.locator('[href="/products/blue-dream-distillate-cart"]')
    ).toHaveCount(0);
  });

  test('Explore More shows at least one online-available product', async ({
    page,
  }) => {
    await page.goto('/products/blue-dream');
    await page.waitForSelector('.related-products', { timeout: 8000 });

    // Multiple online products exist in fixtures; at least one should render
    const cards = page.locator('.related-strip-card');
    await expect(cards).not.toHaveCount(0);
  });
});
