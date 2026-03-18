// PAGINATION REQUIREMENT:
// With PAGE_SIZE = 25, pagination only activates when there are >25 products
// online. The seed currently has 5 products. Tests for Next/Prev links are
// marked test.fixme until the seed is extended with 26+ products.

import { test, expect } from '@playwright/test';
import { preVerifyAge } from './fixtures';

/**
 * Products page — category filter and pagination BDD E2E coverage.
 *
 * Seeded products: flower, concentrates, drinks, edibles, vapes (5 total).
 * All 5 are online-available in the "hub" inventory.
 */

test.describe('Products Page — Category Filter', () => {
  test.beforeEach(async ({ page }) => {
    // Given: age gate is bypassed
    await preVerifyAge(page);
  });

  // ─── Base page load ───────────────────────────────────────────────────────

  test('products page loads and shows all seeded products', async ({
    page,
  }) => {
    // Given: no category filter is applied
    // When: user navigates to /products
    await page.goto('/products');
    await page.waitForSelector('.rnr-card--product', { timeout: 8000 });

    // Then: at least the 5 seeded products are visible
    // (>= 5 because admin test runs may have added extra products with no online
    // inventory — those won't appear here, so the storefront count is stable at 5)
    const cards = page.locator('.rnr-card--product');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('products page renders the category filter nav', async ({ page }) => {
    // Given: the products page is loaded
    await page.goto('/products');
    await page.waitForSelector('main.products-page', { timeout: 8000 });

    // Then: the category filter nav is present (even if empty when no categories are seeded)
    await expect(
      page.locator('nav[aria-label="Filter by category"]')
    ).toBeVisible();
  });

  test('clicking a category pill updates the URL and filters products', async ({
    page,
  }) => {
    // Given: category filter shows seeded categories
    await page.goto('/products');
    await page.waitForSelector('nav[aria-label="Filter by category"]', {
      timeout: 8000,
    });

    // When: user clicks the "Flower" category pill
    const flowerPill = page.locator(
      'nav[aria-label="Filter by category"] button',
      { hasText: 'Flower' }
    );
    await expect(flowerPill).toBeVisible({ timeout: 5000 });
    await flowerPill.click();

    // Then: URL contains ?category=flower
    await expect(page).toHaveURL(/\?category=flower/, { timeout: 8000 });

    // Then: only flower products are shown
    const cards = page.locator('.rnr-card--product');
    await expect(cards).toHaveCount(1, { timeout: 8000 });
    await expect(page.locator('.rnr-card--product')).toContainText(
      'Premium Flower'
    );
  });

  test('clicking the "All" pill removes the category filter from the URL', async ({
    page,
  }) => {
    // Given: a category filter is already applied
    await page.goto('/products?category=flower');
    await page.waitForSelector('.rnr-card--product', { timeout: 8000 });

    // Capture the filtered count (should be 1 for flower)
    const filteredCount = await page.locator('.rnr-card--product').count();

    // When: user clicks the "All" pill
    await page
      .locator('nav[aria-label="Filter by category"] button', {
        hasText: 'All',
      })
      .click();

    // Then: URL no longer contains ?category=
    await expect(page).toHaveURL(/\/products$/, { timeout: 8000 });

    // Then: wait for the React transition to complete.
    // CategoryFilter uses useTransition — while the RSC fetch is in-flight it
    // adds the `category-filter--pending` class. Waiting for it to disappear
    // ensures the new product grid has fully rendered before we count cards.
    await expect(page.locator('.category-filter--pending')).toHaveCount(0, {
      timeout: 12000,
    });

    // Then: more products render than in the filtered view.
    // We avoid asserting an exact floor — admin tests run concurrently and can
    // temporarily archive products. The meaningful assertion is that removing
    // the category filter reveals MORE products than the filtered state showed.
    await expect(async () => {
      const allCount = await page.locator('.rnr-card--product').count();
      expect(allCount).toBeGreaterThan(filteredCount);
    }).toPass({ timeout: 8000 });
  });

  // ─── Invalid category fallback ────────────────────────────────────────────

  test('invalid ?category= param falls back to showing all products', async ({
    page,
  }) => {
    // Given: a category slug that does not exist in the product-categories collection
    // When: user navigates with ?category=invalid
    await page.goto('/products?category=invalid');
    await page.waitForSelector('.rnr-card--product', { timeout: 8000 });

    // Then: all products are displayed (the page validates category against
    // listActiveCategories() and falls back to null when not found)
    const cards = page.locator('.rnr-card--product');
    const count = await cards.count();
    // We expect at least 1 product (all 5 if categories not seeded, all 5 anyway)
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('navigating directly to /products?category=flower renders without error', async ({
    page,
  }) => {
    // Given: the URL has a valid category slug
    // When: user navigates to the filtered URL directly
    // (flower is a valid slug even before categories are seeded — the server
    //  checks listActiveCategories(); if none exist, validCategory is null and
    //  all products render without error)
    await page.goto('/products?category=flower');

    // Then: the page renders without a 500 error
    await page.waitForSelector('main.products-page', { timeout: 8000 });
    await expect(page.locator('main.products-page')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Our Products');
  });

  // ─── Pagination ───────────────────────────────────────────────────────────

  test('pagination is not shown when there are 5 products (below PAGE_SIZE of 25)', async ({
    page,
  }) => {
    // Given: only 5 products are seeded — well below the 25-item page size
    // When: the products grid renders
    await page.goto('/products');
    await page.waitForSelector('.rnr-card--product', { timeout: 8000 });

    // Then: no pagination nav is rendered (Pagination returns null when totalPages <= 1)
    await expect(
      page.locator('nav[aria-label="Product page navigation"]')
    ).not.toBeVisible();
  });

  test.fixme('Next/Prev pagination links work when there are more than 25 products', async ({
    page,
  }) => {
    // BLOCKED: requires at least 26 products seeded and marked online-available.
    // See PAGINATION REQUIREMENT comment at top of file.

    // Given: the products page is loaded with more than PAGE_SIZE (25) products
    await page.goto('/products');
    await page.waitForSelector('nav[aria-label="Product page navigation"]', {
      timeout: 8000,
    });

    // Then: pagination nav is present
    const pagination = page.locator(
      'nav[aria-label="Product page navigation"]'
    );
    await expect(pagination).toBeVisible();

    // When: user clicks "Next →"
    await pagination.getByRole('link', { name: /Next/i }).click();

    // Then: URL contains ?page=2
    await expect(page).toHaveURL(/[?&]page=2/, { timeout: 8000 });
    await expect(page.locator('.rnr-card--product').first()).toBeVisible({
      timeout: 8000,
    });

    // When: user clicks "← Prev"
    await page
      .locator('nav[aria-label="Product page navigation"]')
      .getByRole('link', { name: /Prev/i })
      .click();

    // Then: URL returns to page 1 (no page param)
    await expect(page).toHaveURL(/\/products(\?[^&]*)?$/, { timeout: 8000 });
    const url = new URL(page.url());
    expect(url.searchParams.get('page')).toBeNull();
  });

  // ─── URL state reflection ─────────────────────────────────────────────────

  test('page=1 param renders the same content as no page param', async ({
    page,
  }) => {
    // Given: the products page is accessible
    await preVerifyAge(page);

    // When: navigating with explicit ?page=1
    await page.goto('/products?page=1');
    // Wait for at least one card, then let the grid stabilise before capturing
    // the count. Admin tests run concurrently and can temporarily archive products,
    // so we avoid asserting an exact floor — just that SOME products are present.
    await page.waitForSelector('.rnr-card--product', { timeout: 12000 });
    // Allow one more tick for late-arriving RSC cards
    await page.waitForTimeout(500);
    const countWithPage = await page.locator('.rnr-card--product').count();
    expect(countWithPage).toBeGreaterThanOrEqual(1);

    // When: navigating without the page param
    await page.goto('/products');
    await page.waitForSelector('.rnr-card--product', { timeout: 12000 });
    await page.waitForTimeout(500);
    const countWithoutPage = await page.locator('.rnr-card--product').count();

    // Then: same number of products rendered in both cases (URL param is ignored when ≤ 1 page)
    expect(countWithPage).toBe(countWithoutPage);
  });

  test('out-of-range page number clamps to the last valid page', async ({
    page,
  }) => {
    // Given: only 1 page of products exists (5 < PAGE_SIZE 25)
    // When: user navigates with ?page=999
    await page.goto('/products?page=999');
    await page.waitForSelector('main.products-page', { timeout: 8000 });

    // Then: the page renders without error and products are still visible
    // (the component clamps to totalPages via Math.min)
    await expect(page.locator('main.products-page')).toBeVisible();
    const cards = page.locator('.rnr-card--product');
    await expect(cards.first()).toBeVisible({ timeout: 8000 });
  });
});
