/**
 * Admin Products — cursor-based Prev/Next pagination BDD E2E coverage.
 *
 * Architecture under test (PR #177 — worker/feature-cursor-pagination):
 *   - /admin/products reads searchParams.cursor and searchParams.prevCursors
 *   - AdminTablePagination renders Prev/Next controls as <Link> or disabled <span>
 *   - prevCursor === undefined on page 1 → Prev renders as aria-disabled="true" span
 *   - nextCursor !== null when items.length === limit (default 50)
 *
 * Base seed: 5 active products — well below the admin PAGE_SIZE of 50.
 * Both tests need > 50 active products so AdminTablePagination renders at all.
 * Extra products are seeded in beforeAll via the Firestore emulator REST API.
 */

import { test, expect } from '@playwright/test';
import { preVerifyAge, establishAdminSession } from './fixtures';

// ── Emulator seeding helpers ─────────────────────────────────────────────────

const EMULATOR_FIRESTORE = 'http://localhost:8080';
const PROJECT_ID = 'rush-n-relax';

async function seedAdminProduct(slug: string): Promise<void> {
  const url = `${EMULATOR_FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/products/${slug}`;
  const body = JSON.stringify({
    fields: {
      slug: { stringValue: slug },
      name: { stringValue: `E2E Admin Pg ${slug}` },
      category: { stringValue: 'flower' },
      details: { stringValue: 'Seeded for admin pagination E2E test.' },
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

// ── Suite config ─────────────────────────────────────────────────────────────

test.describe.configure({ mode: 'serial' });

test.describe('Admin Products — Prev/Next Cursor Pagination', () => {
  // Seed 50 extra products so the admin list exceeds the 50-item page limit,
  // causing AdminTablePagination to render with a Next link.
  const EXTRA_PREFIX = 'e2e-adm-pg';

  test.beforeAll(async () => {
    // Seed 51 products with slugs that sort after existing fixture products alphabetically.
    // Existing fixtures: concentrates, drinks, edibles, flower, vapes (all lowercase c/d/e/f/v).
    // Using 'z-' prefix guarantees these appear on the end, making the cursor stack predictable.
    for (let i = 0; i < 51; i++) {
      await seedAdminProduct(`${EXTRA_PREFIX}-${String(i).padStart(3, '0')}`);
    }
  });

  test.beforeEach(async ({ page }) => {
    // Given: age gate is bypassed and an admin session is established
    await preVerifyAge(page);
    await page.goto('/admin/login');
    await establishAdminSession(page);
  });

  // ─── Test 4: Prev link has aria-disabled on page 1 ───────────────────────

  test('Prev link has aria-disabled="true" on the first admin page', async ({
    page,
  }) => {
    // Given: admin is on the first page of products (no cursor param)
    // When: navigating to /admin/products
    await page.goto('/admin/products');
    await page.waitForSelector('.admin-table', { timeout: 8000 });

    // Then: AdminTablePagination is rendered (> 50 products seeded)
    const pagination = page.locator('nav[aria-label="Table pagination"]');
    await expect(pagination).toBeVisible({ timeout: 5000 });

    // Then: the Prev control is a <span> with aria-disabled="true" (not a link)
    // AdminTablePagination renders a disabled span when prevCursor === undefined
    const prevControl = pagination.locator('[aria-disabled="true"]', {
      hasText: 'Previous',
    });
    await expect(prevControl).toBeVisible();

    // Then: the Prev control is NOT an <a> element (it should not be navigable)
    const prevLink = pagination.getByRole('link', { name: /Previous/i });
    await expect(prevLink).not.toBeAttached();
  });

  // ─── Test 5: Next → Prev round-trip returns identical page 1 product set ─

  test('Next → Prev round-trip returns to the identical page 1 product set', async ({
    page,
  }) => {
    // Given: admin is on the first page of /admin/products
    await page.goto('/admin/products');
    await page.waitForSelector('.admin-table tbody tr', { timeout: 8000 });

    // Record the product names visible on page 1
    const page1Names = await page.locator('.admin-table tbody tr td:first-child').allTextContents();
    expect(page1Names.length).toBe(50); // full page = limit 50

    // When: user clicks Next →
    const pagination = page.locator('nav[aria-label="Table pagination"]');
    await pagination.getByRole('link', { name: /Next/i }).click();

    // Then: URL contains ?cursor= param (cursor-based navigation)
    await expect(page).toHaveURL(/[?&]cursor=/, { timeout: 8000 });
    await page.waitForSelector('.admin-table tbody tr', { timeout: 8000 });

    // Then: page 2 product names differ from page 1
    const page2Names = await page.locator('.admin-table tbody tr td:first-child').allTextContents();
    expect(page2Names).not.toEqual(page1Names);

    // When: user clicks ← Previous
    await page.locator('nav[aria-label="Table pagination"]')
      .getByRole('link', { name: /Previous/i })
      .click();

    // Then: URL returns to /admin/products (no cursor param on page 1)
    await expect(page).toHaveURL(/\/admin\/products(\?.*)?$/, { timeout: 8000 });
    // Page 1 with no cursor should have no cursor param at all
    const url = new URL(page.url());
    expect(url.searchParams.get('cursor')).toBeNull();

    await page.waitForSelector('.admin-table tbody tr', { timeout: 8000 });

    // Then: the page 1 product set is identical to the original
    const returnedNames = await page.locator('.admin-table tbody tr td:first-child').allTextContents();
    expect(returnedNames).toEqual(page1Names);
  });
});
