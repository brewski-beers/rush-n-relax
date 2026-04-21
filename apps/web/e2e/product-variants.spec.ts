import { test, expect } from '@playwright/test';
import { preVerifyAge } from './fixtures';

/**
 * Product Variants — category-aware sizing labels and options.
 *
 * Relies on seeded products: flower, edibles, vapes, drinks, concentrates.
 * Emulator must be running with seed data loaded.
 */

test.describe('Product Variants — Category-aware sizing', () => {
  test.beforeEach(async ({ page }) => {
    await preVerifyAge(page);
  });

  test('flower product shows weight-based label and options', async ({
    page,
  }) => {
    await page.goto('/products/flower');
    await page.waitForSelector('.product-pricing-block', { timeout: 8000 });

    const label = page.locator('.product-hero-tag-label', {
      hasText: /select weight/i,
    });
    await expect(label).toBeVisible();

    // At least one weight variant visible
    await expect(
      page.locator('.product-variant-card-size', { hasText: '1/8 oz' })
    ).toBeVisible();
  });

  test('edibles product shows quantity-based label and options', async ({
    page,
  }) => {
    await page.goto('/products/edibles');
    await page.waitForSelector('.product-pricing-block', { timeout: 8000 });

    const label = page.locator('.product-hero-tag-label', {
      hasText: /select quantity/i,
    });
    await expect(label).toBeVisible();

    await expect(
      page.locator('.product-variant-card-size', { hasText: '1pc' })
    ).toBeVisible();
  });

  test('vapes product shows quantity-based label and options', async ({
    page,
  }) => {
    await page.goto('/products/vapes');
    await page.waitForSelector('.product-pricing-block', { timeout: 8000 });

    const label = page.locator('.product-hero-tag-label', {
      hasText: /select quantity/i,
    });
    await expect(label).toBeVisible();

    await expect(
      page.locator('.product-variant-card-size', { hasText: 'Single Cart' })
    ).toBeVisible();
  });

  test('variant card toggles active state on click', async ({ page }) => {
    await page.goto('/products/flower');
    await page.waitForSelector('.product-variant-card', { timeout: 8000 });

    const cards = page.locator('.product-variant-card');
    const second = cards.nth(1);
    await second.click();
    await expect(second).toHaveClass(/product-variant-card--active/);
    await expect(second).toHaveAttribute('aria-pressed', 'true');
  });
});
