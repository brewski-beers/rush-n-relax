import path from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import { test, expect } from '@playwright/test';
import { preVerifyAge, establishAdminSession } from './fixtures';

/**
 * Admin Product Image Upload — BDD E2E coverage.
 *
 * Tests the FeaturedSlot UI on the product edit page.
 *
 * Storage notes:
 * - The Firebase Storage emulator is running on :9199 (seeded by dev:seed).
 * - Uploads POST to /api/admin/products/upload-image which proxies to Storage.
 * - On success the component sets an optimistic object URL (blob:) then
 *   transitions to the confirmed storage path.
 * - We assert on the <img> preview appearing and the remove button functioning.
 *
 * The fixture PNG is a minimal 1×1 transparent PNG created inline via Buffer —
 * no external file dependency required.
 */

/** Minimal 1×1 transparent PNG as a base64 string. */
const TRANSPARENT_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5R8f0AAAAASUVORK5CYII=';

test.describe('Admin Product Image Upload — Featured Slot', () => {
  let testImagePath: string;

  test.beforeAll(async () => {
    // Create a 1×1 PNG fixture that all tests in this suite share
    const buf = Buffer.from(TRANSPARENT_PNG_BASE64, 'base64');
    const tmpPath = path.join(
      process.cwd(),
      'e2e',
      'fixtures',
      'test-image.png'
    );
    mkdirSync(path.dirname(tmpPath), { recursive: true });
    writeFileSync(tmpPath, buf);
    testImagePath = tmpPath;
  });

  test.beforeEach(async ({ page }) => {
    // Given: age gate is bypassed and an admin session is established
    await preVerifyAge(page);
    await page.goto('/admin/login');
    await establishAdminSession(page);
  });

  // ─── Upload ───────────────────────────────────────────────────────────────

  test('uploading a PNG to the featured slot shows an image preview', async ({
    page,
  }) => {
    // Given: the flower product edit page is loaded
    await page.goto('/admin/products/flower/edit');
    await page.waitForSelector('.admin-form', { timeout: 8000 });

    // Given: the featured image upload zone is visible
    const featuredZone = page.locator(
      '[aria-label="Featured image upload zone"]'
    );
    await expect(featuredZone).toBeVisible();

    // The file input is hidden (aria-hidden, tabIndex -1) — we target it directly
    const fileInput = featuredZone.locator('..').locator('input[type="file"]');

    // When: a valid PNG is attached to the hidden file input
    await fileInput.setInputFiles(testImagePath);

    // Then: the featured zone displays an <img> preview
    // The component first shows a blob: URL (optimistic) then the resolved Storage URL.
    // We wait for the img to appear — either URL is a valid preview.
    await expect(featuredZone.locator('img')).toBeVisible({ timeout: 10000 });
    const src = await featuredZone.locator('img').getAttribute('src');
    expect(src).toBeTruthy();
  });

  test('remove button clears the featured image slot', async ({ page }) => {
    // Given: the flower product edit page already has a featured image
    // (seeded as "products/flower.png" in Storage emulator)
    await page.goto('/admin/products/flower/edit');
    await page.waitForSelector('.admin-form', { timeout: 8000 });

    const featuredZone = page.locator(
      '[aria-label="Featured image upload zone"]'
    );

    // Wait for the existing image to resolve from Storage (the useResolvedSrc hook
    // fires an async getDownloadURL call on mount)
    // If it resolves — great. If Storage is slow / unreachable, we upload first.
    const hasImage = await featuredZone
      .locator('img')
      .isVisible()
      .catch(() => false);

    if (!hasImage) {
      // Upload first so we have something to remove
      const fileInput = featuredZone
        .locator('..')
        .locator('input[type="file"]');
      await fileInput.setInputFiles(testImagePath);
      await expect(featuredZone.locator('img')).toBeVisible({ timeout: 10000 });
    }

    // When: the remove button (×) is clicked
    const removeBtn = page.locator(
      'button[aria-label="Remove featured image"]'
    );
    await expect(removeBtn).toBeVisible({ timeout: 5000 });
    await removeBtn.click();

    // Then: the image is removed and the empty-state label appears
    await expect(featuredZone.locator('img')).not.toBeVisible({
      timeout: 5000,
    });
    await expect(featuredZone.locator('.img-upload-zone-label')).toBeVisible({
      timeout: 5000,
    });
  });

  // ─── Validation ───────────────────────────────────────────────────────────

  test('uploading an oversized file shows a size error', async ({ page }) => {
    // Given: the product edit page is loaded
    await page.goto('/admin/products/flower/edit');
    await page.waitForSelector('.admin-form', { timeout: 8000 });

    const featuredZone = page.locator(
      '[aria-label="Featured image upload zone"]'
    );
    const fileInput = featuredZone.locator('..').locator('input[type="file"]');

    // Create a >5MB buffer to exceed the MAX_BYTES limit
    const oversizePath = path.join(
      process.cwd(),
      'e2e',
      'fixtures',
      'oversize-image.png'
    );
    mkdirSync(path.dirname(oversizePath), { recursive: true });
    // 6 MB of zeros — not a real PNG but the size check fires before decoding
    writeFileSync(oversizePath, Buffer.alloc(6 * 1024 * 1024, 0));

    // When: the oversized file is selected
    await fileInput.setInputFiles(oversizePath);

    // Then: the size error message appears
    await expect(page.locator('.img-upload-error')).toContainText(
      'Max file size is 5 MB',
      { timeout: 5000 }
    );
  });

  test('empty-state zone renders the browse prompt when no image is loaded', async ({
    page,
  }) => {
    // Given: a product with no featured image — we use a fresh product.
    // We cannot guarantee no image on "flower" without clearing it first,
    // so we check the create form (slug is blank → no upload section shown).
    // Instead, navigate to an edit page and clear the featured image first.
    await page.goto('/admin/products/edibles/edit');
    await page.waitForSelector('.admin-form', { timeout: 8000 });

    const featuredZone = page.locator(
      '[aria-label="Featured image upload zone"]'
    );
    await expect(featuredZone).toBeVisible();

    // If an image exists, remove it
    const removeBtn = page.locator(
      'button[aria-label="Remove featured image"]'
    );
    const hasRemoveBtn = await removeBtn.isVisible().catch(() => false);
    if (hasRemoveBtn) {
      await removeBtn.click();
      await expect(featuredZone.locator('img')).not.toBeVisible({
        timeout: 5000,
      });
    }

    // Then: the empty-state label prompts the user to drop or browse
    await expect(page.locator('.img-upload-zone-label')).toContainText(
      'Drop image here or click to browse'
    );
  });
});
