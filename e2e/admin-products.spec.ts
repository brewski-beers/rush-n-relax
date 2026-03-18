import { test, expect } from '@playwright/test';
import { preVerifyAge, establishAdminSession } from './fixtures';

/**
 * Admin Products CRUD — BDD E2E coverage.
 *
 * Seeded products (from emulator): flower, concentrates, drinks, edibles, vapes.
 * All tests establish an admin session before navigating to /admin/products.
 *
 * Isolation notes:
 * - serial mode prevents the two browser projects from running these tests
 *   concurrently and interleaving mutations against the shared emulator.
 * - The create test uses a timestamp slug so repeated runs don't collide.
 * - The edit test reads the current name from the DOM rather than asserting
 *   a hardcoded pre-edit value, so it's safe regardless of prior test runs.
 * - ConfirmButton uses window.confirm() — Playwright must accept the dialog
 *   via page.on('dialog') before clicking the trigger button.
 */

test.describe.configure({ mode: 'serial' });

test.describe('Admin Products', () => {
  test.beforeEach(async ({ page }) => {
    // Given: age gate is bypassed and an admin session is established
    await preVerifyAge(page);
    await page.goto('/admin/login');
    await establishAdminSession(page);
  });

  // ─── Products list ───────────────────────────────────────────────────────

  test('products list renders all seeded products', async ({ page }) => {
    // Given: an authenticated admin session
    // When: navigating to /admin/products
    await page.goto('/admin/products');
    await page.waitForSelector('.admin-table', { timeout: 8000 });

    // Then: each seeded product name appears in the table
    await expect(page.locator('.admin-table')).toContainText('Premium Flower');
    await expect(page.locator('.admin-table')).toContainText(
      'Premium Concentrates'
    );
    await expect(page.locator('.admin-table')).toContainText(
      'THCa Infused Drinks'
    );
    await expect(page.locator('.admin-table')).toContainText('Gourmet Edibles');
    await expect(page.locator('.admin-table')).toContainText(
      'Sleek Vape Devices'
    );
  });

  test('products list has a "New Product" link', async ({ page }) => {
    // Given: authenticated admin on /admin/products
    await page.goto('/admin/products');
    await page.waitForSelector('.admin-page-header', { timeout: 8000 });

    // Then: "New Product" link points to the create page
    const newProductLink = page.getByRole('link', { name: 'New Product' });
    await expect(newProductLink).toBeVisible();
    await expect(newProductLink).toHaveAttribute('href', '/admin/products/new');
  });

  test('each product row has an Edit link', async ({ page }) => {
    // Given: the products list is loaded
    await page.goto('/admin/products');
    await page.waitForSelector('.admin-table', { timeout: 8000 });

    // Then: every seeded row has an Edit action link
    // Use >= 5 in case prior test runs left extra products
    const editLinks = page.locator('.admin-table .admin-actions a', {
      hasText: 'Edit',
    });
    const count = await editLinks.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  // ─── New product ─────────────────────────────────────────────────────────

  test('navigating to New Product shows the create form', async ({ page }) => {
    // Given: authenticated admin
    // When: clicking "New Product"
    await page.goto('/admin/products');
    await page.waitForSelector('.admin-page-header', { timeout: 8000 });
    await page.getByRole('link', { name: 'New Product' }).click();

    // Then: the create form is rendered
    await expect(page).toHaveURL(/\/admin\/products\/new/, { timeout: 8000 });
    await expect(
      page.getByRole('heading', { level: 1, name: 'New Product' })
    ).toBeVisible();
    await expect(page.locator('input[name="slug"]')).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('select[name="category"]')).toBeVisible();
  });

  test('creating a new product redirects to list and shows the new product', async ({
    page,
  }) => {
    // Given: admin is on the new product form
    await page.goto('/admin/products/new');
    await page.waitForSelector('.admin-form', { timeout: 8000 });

    // Use a timestamp slug to avoid slug-collision across repeated test runs
    const uniqueSlug = `e2e-product-${Date.now()}`;
    const uniqueName = `E2E Product ${uniqueSlug}`;

    // When: all required fields are filled
    await page.locator('input[name="slug"]').fill(uniqueSlug);
    await page.locator('input[name="name"]').fill(uniqueName);

    // Select the first seeded category — "Flower" (slug: flower, order: 1)
    await page.locator('select[name="category"]').selectOption('flower');

    await page
      .locator('textarea[name="description"]')
      .fill('A product created by E2E tests.');
    await page
      .locator('textarea[name="details"]')
      .fill('Detailed description for E2E test product.');

    // When: user submits the form
    await page.locator('button[type="submit"]').click();

    // Then: redirected back to the products list
    await expect(page).toHaveURL(/\/admin\/products$/, { timeout: 10000 });

    // Then: the new product appears in the table
    await expect(page.locator('.admin-table')).toContainText(uniqueName);
  });

  // ─── Edit product ────────────────────────────────────────────────────────

  test('editing a product name and saving updates the list', async ({
    page,
  }) => {
    // Given: admin navigates to the edibles edit page
    // (using edibles rather than flower to avoid conflict with the list test
    // which checks for 'Premium Flower')
    await page.goto('/admin/products/edibles/edit');
    await page.waitForSelector('.admin-form', { timeout: 8000 });
    await expect(
      page.getByRole('heading', { level: 1, name: /Edit Product/i })
    ).toBeVisible();

    // Read the current name from the DOM so the test is resilient to prior edits
    const nameInput = page.locator('input[name="name"]');
    const currentName = await nameInput.inputValue();
    const editedName = `${currentName} — Edited`;

    // When: the name field is updated
    await nameInput.clear();
    await nameInput.fill(editedName);

    // When: user submits
    await page.locator('button[type="submit"]').click();

    // Then: redirected to the products list
    await expect(page).toHaveURL(/\/admin\/products$/, { timeout: 10000 });

    // Then: updated name is visible in the table
    await expect(page.locator('.admin-table')).toContainText(editedName);
  });

  test('edit form is pre-populated with existing product values', async ({
    page,
  }) => {
    // Given: admin opens the edit page for "concentrates"
    await page.goto('/admin/products/concentrates/edit');
    await page.waitForSelector('.admin-form', { timeout: 8000 });

    // Then: name field has a non-empty value (whatever the current product name is)
    const nameValue = await page.locator('input[name="name"]').inputValue();
    expect(nameValue.length).toBeGreaterThan(0);

    // Then: description textarea is populated
    const description = await page
      .locator('textarea[name="description"]')
      .inputValue();
    expect(description.length).toBeGreaterThan(0);
  });

  // ─── Archive / Restore ───────────────────────────────────────────────────
  //
  // ConfirmButton uses window.confirm() — a native browser dialog.
  // Playwright auto-dismisses dialogs (returns false = cancel) unless we
  // register a handler with page.on('dialog', …) before triggering the click.

  test('archiving a product changes its status to archived in the list', async ({
    page,
  }) => {
    // Given: a test-specific product is created so seeded products are never
    // modified. Seeded products (like vapes) must stay active at all times because
    // storefront tests running concurrently assert on the product count.
    const slug = `e2e-archive-${Date.now()}`;
    const name = `E2E Archive Test ${slug}`;
    await page.goto('/admin/products/new');
    await page.waitForSelector('.admin-form', { timeout: 8000 });
    await page.locator('input[name="slug"]').fill(slug);
    await page.locator('input[name="name"]').fill(name);
    await page.locator('select[name="category"]').selectOption('flower');
    await page
      .locator('textarea[name="description"]')
      .fill('Archive test product.');
    await page
      .locator('textarea[name="details"]')
      .fill('Archive test details.');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/admin\/products$/, { timeout: 10000 });

    // Given: the new product appears in the list with Archive button
    const productRow = page.locator('.admin-table tbody tr', { hasText: name });
    await expect(productRow).toBeVisible({ timeout: 8000 });

    // When: user accepts the window.confirm dialog and clicks Archive
    page.once('dialog', dialog => void dialog.accept());
    await productRow.getByRole('button', { name: 'Archive' }).click();

    // Then: the page reloads and the row status shows archived
    await page.waitForSelector('.admin-table', { timeout: 8000 });
    const updatedRow = page.locator('.admin-table tbody tr', { hasText: name });
    await expect(updatedRow).toContainText('archived');

    // Then: a Restore button appears in place of Archive
    await expect(
      updatedRow.getByRole('button', { name: 'Restore' })
    ).toBeVisible();
  });

  test('restoring an archived product changes its status back to active', async ({
    page,
  }) => {
    // Given: a test-specific product is created and immediately archived via the
    // edit form, so no seeded product is ever put into archived state.
    const slug = `e2e-restore-${Date.now()}`;
    const name = `E2E Restore Test ${slug}`;
    await page.goto('/admin/products/new');
    await page.waitForSelector('.admin-form', { timeout: 8000 });
    await page.locator('input[name="slug"]').fill(slug);
    await page.locator('input[name="name"]').fill(name);
    await page.locator('select[name="category"]').selectOption('flower');
    await page
      .locator('textarea[name="description"]')
      .fill('Restore test product.');
    await page
      .locator('textarea[name="details"]')
      .fill('Restore test details.');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/admin\/products$/, { timeout: 10000 });

    // Given: archive the product via the edit form
    await page.goto(`/admin/products/${slug}/edit`);
    await page.waitForSelector('.admin-form', { timeout: 8000 });
    await page.locator('select[name="status"]').selectOption('archived');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/admin\/products$/, { timeout: 10000 });

    // Given: the products list shows the product in archived state
    await page.waitForSelector('.admin-table', { timeout: 8000 });
    const productRow = page.locator('.admin-table tbody tr', { hasText: name });
    await expect(
      productRow.getByRole('button', { name: 'Restore' })
    ).toBeVisible({ timeout: 5000 });

    // When: user accepts the window.confirm dialog and clicks Restore
    page.once('dialog', dialog => void dialog.accept());
    await productRow.getByRole('button', { name: 'Restore' }).click();

    // Then: the product status reverts — no longer "archived"
    await page.waitForSelector('.admin-table', { timeout: 8000 });
    const updatedRow = page.locator('.admin-table tbody tr', { hasText: name });
    await expect(updatedRow).not.toContainText('archived');
    await expect(
      updatedRow.getByRole('button', { name: 'Archive' })
    ).toBeVisible();
  });
});
