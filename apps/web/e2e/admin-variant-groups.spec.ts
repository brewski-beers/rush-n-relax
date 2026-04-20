import { test, expect } from '@playwright/test';
import { preVerifyAge, establishAdminSession } from './fixtures';

/**
 * Admin Variant Groups CRUD — BDD E2E coverage.
 *
 * Covers:
 *  - Creating a new variant group via the /admin/variant-groups/new form
 *  - Deleting an existing variant group from the list
 *
 * Isolation notes:
 *  - serial mode prevents concurrent mutations against the shared emulator.
 *  - The create test uses a timestamp-based key to avoid key-collision across runs.
 *  - Delete test relies on the create test having run first (serial dependency).
 *  - ConfirmButton uses window.confirm() — Playwright must accept the dialog
 *    via page.on('dialog') before clicking the trigger button.
 */

test.describe.configure({ mode: 'serial' });

test.describe('Admin Variant Groups', () => {
  test.beforeEach(async ({ page }) => {
    // Given: age gate is bypassed and an admin session is established
    await preVerifyAge(page);
    await page.goto('/admin/login');
    await establishAdminSession(page);
  });

  // ─── Create ───────────────────────────────────────────────────────────────

  test('authenticated admin creates a new variant group and it appears in the list', async ({
    page,
  }) => {
    // Given: admin navigates to the new variant group form
    await page.goto('/admin/variant-groups/new');
    await page.waitForSelector('.admin-form', { timeout: 8000 });

    // Use a timestamp key to avoid key collisions across repeated runs
    const uniqueKey = `e2e-group-${Date.now()}`;
    const uniqueLabel = `E2E Group ${uniqueKey}`;

    // When: all required fields are filled and the form is submitted
    await page.locator('input[name="key"]').fill(uniqueKey);
    await page.locator('input[name="label"]').fill(uniqueLabel);

    await page.locator('button[type="submit"]').click();

    // Then: redirects to the list and the new group is visible
    await expect(page).toHaveURL(/\/admin\/variant-groups/, { timeout: 8000 });
    await expect(page.locator('.admin-table')).toContainText(uniqueLabel, {
      timeout: 8000,
    });
  });

  // ─── Delete ───────────────────────────────────────────────────────────────

  test('authenticated admin deletes an existing variant group and it is removed from the list', async ({
    page,
  }) => {
    // Given: at least one variant group exists (created by the previous test or seeded)
    await page.goto('/admin/variant-groups');
    await page.waitForSelector('.admin-table', { timeout: 8000 });

    // Record the label of the first row before deletion
    const firstRowLabel = await page
      .locator('.admin-table tbody tr:first-child td:first-child')
      .textContent({ timeout: 5000 });

    // When: admin clicks Delete on the first row and confirms the dialog
    page.on('dialog', dialog => dialog.accept());

    await page
      .locator('.admin-table tbody tr:first-child')
      .getByRole('button', { name: /delete/i })
      .click();

    // Then: the group is no longer present in the table
    await expect(page.locator('.admin-table')).not.toContainText(
      firstRowLabel ?? '',
      { timeout: 8000 }
    );
  });
});
