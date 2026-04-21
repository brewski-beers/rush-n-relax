/**
 * Storefront Products — cursor-based "Load More" pagination BDD E2E coverage.
 *
 * Architecture under test (PR #177 — worker/feature-cursor-pagination):
 *   - ProductsGrid (Server Component) fetches page 1 via listOnlineAvailableInventory
 *   - ProductsGridClient (Client Component) renders cards + Load More button
 *   - /api/products handles subsequent cursor-fetched pages
 *   - useLoadMore hook manages client-side state
 *
 * Base seed: ~11 in-stock online products (< PAGE_SIZE 25) — Load More hidden.
 * Tests that need >25 products seed extras in beforeAll via the Firestore emulator REST API.
 */

import { test, expect } from '@playwright/test';
import { preVerifyAge } from './fixtures';

// ── Emulator seeding helpers ─────────────────────────────────────────────────

const EMULATOR_FIRESTORE = 'http://localhost:8080';
const PROJECT_ID = 'rush-n-relax';
const ONLINE_LOCATION_ID = 'online';

/**
 * Write a minimal product document to the emulator.
 * Uses the Firestore REST API — no Admin SDK required in the test runner.
 */
async function seedProduct(slug: string, category: string): Promise<void> {
  const url = `${EMULATOR_FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/products/${slug}`;
  const body = JSON.stringify({
    fields: {
      slug: { stringValue: slug },
      name: { stringValue: `E2E Pagination ${slug}` },
      category: { stringValue: category },
      details: { stringValue: 'Seeded for pagination E2E test.' },
      status: { stringValue: 'active' },
      availableAt: { arrayValue: { values: [] } },
    },
  });
  await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

/**
 * Write an online inventory item for a product to the emulator.
 * The inventory query filters on inStock == true to determine pagination pages.
 */
async function seedOnlineInventory(slug: string): Promise<void> {
  const url = `${EMULATOR_FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/inventory/${ONLINE_LOCATION_ID}/items/${slug}`;
  const body = JSON.stringify({
    fields: {
      productId: { stringValue: slug },
      locationId: { stringValue: ONLINE_LOCATION_ID },
      inStock: { booleanValue: true },
      availableOnline: { booleanValue: true },
      availablePickup: { booleanValue: false },
      featured: { booleanValue: false },
      quantity: { integerValue: '10' },
    },
  });
  await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

/**
 * Seed N extra products with online inventory so the storefront exceeds PAGE_SIZE (25).
 * Slugs are prefixed with 'e2e-pg-' to avoid collision with seeded fixtures.
 * Uses a namespace prefix to isolate sets when category matters.
 */
async function seedExtraProducts(
  count: number,
  category: string,
  prefix: string
): Promise<string[]> {
  const slugs: string[] = [];
  for (let i = 0; i < count; i++) {
    const slug = `${prefix}-${String(i).padStart(3, '0')}`;
    slugs.push(slug);
    await seedProduct(slug, category);
    await seedOnlineInventory(slug);
  }
  return slugs;
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('Products Page — Load More Pagination', () => {
  test.beforeEach(async ({ page }) => {
    // Given: age gate is bypassed before navigation
    await preVerifyAge(page);
  });

  // ─── Test 1: Load More hidden when all products fit on one page ───────────

  test('Load More button is hidden when all products fit on one page', async ({
    page,
  }) => {
    // Given: only ~11 products are seeded online (< PAGE_SIZE 25)
    // When: user navigates to /products
    await page.goto('/products');
    await page.waitForSelector('.rnr-card--product', { timeout: 8000 });

    // Then: the Load More button is not present in the DOM
    // (ProductsGridClient only renders it when hasMore === true,
    //  which requires initialNextCursor !== null from the server)
    await expect(page.locator('.load-more-btn')).not.toBeVisible();
  });

  // ─── Test 2: Load More appends next page and disappears on last page ──────

  test.describe('when more than 25 products are available', () => {
    // Seed 20 extra products (all category: flower) so total > 25
    // beforeAll runs once; products persist for the lifetime of the emulator session.
    // Using a unique prefix avoids collisions with other test runs.
    const EXTRA_PREFIX = 'e2e-pg-load-more';
    const EXTRA_COUNT = 20;

    test.beforeAll(async () => {
      await seedExtraProducts(EXTRA_COUNT, 'flower', EXTRA_PREFIX);
    });

    test('clicking Load More appends products and button disappears on the last page', async ({
      page,
    }) => {
      // Given: more than 25 products are available online
      // When: user navigates to /products
      await page.goto('/products');
      await page.waitForSelector('.rnr-card--product', { timeout: 10000 });

      // Then: the Load More button is visible (nextCursor is non-null)
      const loadMoreBtn = page.locator('.load-more-btn');
      await expect(loadMoreBtn).toBeVisible({ timeout: 8000 });

      // Record initial card count
      const initialCount = await page.locator('.rnr-card--product').count();
      expect(initialCount).toBe(25);

      // When: user clicks Load More
      await loadMoreBtn.click();

      // Then: new cards are appended (total > 25)
      await expect(async () => {
        const newCount = await page.locator('.rnr-card--product').count();
        expect(newCount).toBeGreaterThan(initialCount);
      }).toPass({ timeout: 10000 });

      // Then: once all pages are consumed, Load More button disappears
      // Keep clicking until it disappears or we've done 5 rounds (safety cap)
      for (let i = 0; i < 5; i++) {
        const btn = page.locator('.load-more-btn');
        const visible = await btn.isVisible().catch(() => false);
        if (!visible) break;
        await btn.click();
        // Wait for card count to increase before checking again
        await page.waitForTimeout(1000);
      }

      await expect(page.locator('.load-more-btn')).not.toBeVisible({
        timeout: 8000,
      });
    });

    // ─── Test 3: Load More preserves ?category= filter ───────────────────────

    test('Load More preserves the category filter — URL retains ?category= and fetcher includes it', async ({
      page,
    }) => {
      // Given: more than 25 products are available online (seeded above)
      // When: user navigates with ?category=flower and Load More is available
      await page.goto('/products');
      await page.waitForSelector('.rnr-card--product', { timeout: 10000 });

      // Navigate to the flower-filtered view — the ProductsGrid server component
      // renders the first page filtered to flower only
      const flowerPill = page.locator(
        'nav[aria-label="Filter by category"] button',
        { hasText: 'Flower' }
      );
      await flowerPill.click();
      await expect(page).toHaveURL(/\?category=flower/, { timeout: 8000 });

      // Wait for filtered cards to render
      await page.waitForSelector('.rnr-card--product', { timeout: 8000 });

      // If Load More is not visible (all flower products fit on one page after
      // inventory cursor distribution), note it and verify no non-flower cards appear
      const loadMoreBtn = page.locator('.load-more-btn');
      const hasMore = await loadMoreBtn.isVisible().catch(() => false);

      if (hasMore) {
        // Intercept the API call to verify category is passed in the request
        const [request] = await Promise.all([
          page.waitForRequest(req =>
            req.url().includes('/api/products') &&
            req.url().includes('category=flower')
          ),
          loadMoreBtn.click(),
        ]);

        // Then: the outbound /api/products request includes category=flower
        expect(request.url()).toContain('category=flower');

        // Then: the URL still contains ?category=flower (no navigation happened)
        expect(page.url()).toContain('category=flower');
      }

      // Then: all visible product cards show 'flower' as their category label
      // (regardless of whether Load More fired — the category filter must be preserved)
      const categoryLabels = page.locator('.product-category');
      const labelCount = await categoryLabels.count();
      for (let i = 0; i < labelCount; i++) {
        await expect(categoryLabels.nth(i)).toHaveText('flower');
      }
    });
  });
});
