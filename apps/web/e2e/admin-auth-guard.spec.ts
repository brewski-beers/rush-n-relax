import { test, expect } from '@playwright/test';
import { preVerifyAge, establishAdminSession } from './fixtures';

/**
 * Admin Auth Guard — BDD E2E coverage.
 *
 * Verifies that the middleware correctly redirects unauthenticated users
 * away from all protected /admin/* routes, and that a valid __session cookie
 * allows access to those routes.
 *
 * Auth is handled by requireRole() in each admin page, which reads the
 * __session cookie via Firebase Admin SDK.
 */

const PROTECTED_ROUTES = [
  '/admin/dashboard',
  '/admin/products',
  '/admin/locations',
];

test.describe('Admin Auth Guard — unauthenticated redirects', () => {
  test.beforeEach(async ({ page }) => {
    // Given: no session cookie is present (clear all cookies)
    await page.context().clearCookies();
    // Age gate does not render on /admin routes, but preVerifyAge is harmless
    await preVerifyAge(page);
  });

  for (const route of PROTECTED_ROUTES) {
    test(`unauthenticated request to ${route} redirects to /admin/login`, async ({
      page,
    }) => {
      // Given: no __session cookie
      // When: user navigates directly to a protected admin route
      await page.goto(route);

      // Then: they are redirected to /admin/login
      await expect(page).toHaveURL(/\/admin\/login/, { timeout: 8000 });
      await expect(
        page.getByRole('heading', { level: 1, name: 'Sign in' })
      ).toBeVisible();
    });
  }

  test('/admin root redirects unauthenticated users to /admin/login', async ({
    page,
  }) => {
    // Given: no session
    // When: user navigates to /admin
    await page.goto('/admin');

    // Then: redirected to login
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 8000 });
  });
});

test.describe('Admin Auth Guard — authenticated access', () => {
  test.beforeEach(async ({ page }) => {
    // Given: age gate is bypassed and an admin session is established
    await preVerifyAge(page);
    // Need a page.goto before establishAdminSession so page.url() has a hostname
    await page.goto('/admin/login');
    await establishAdminSession(page);
  });

  test('authenticated admin can access /admin/dashboard', async ({ page }) => {
    // Given: valid __session cookie is set
    // When: user navigates to the dashboard
    await page.goto('/admin/dashboard');

    // Then: the dashboard renders — no redirect to login
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 8000 });
    await expect(
      page.getByRole('heading', { level: 1, name: 'Admin Dashboard' })
    ).toBeVisible();
  });

  test('authenticated admin can access /admin/products', async ({ page }) => {
    // Given: valid __session cookie
    // When: navigating to products list
    await page.goto('/admin/products');

    // Then: products page renders
    await expect(page).toHaveURL(/\/admin\/products/, { timeout: 8000 });
    await expect(
      page.getByRole('heading', { level: 1, name: 'Products' })
    ).toBeVisible();
  });

  test('authenticated admin can access /admin/locations', async ({ page }) => {
    // Given: valid __session cookie
    // When: navigating to locations list
    await page.goto('/admin/locations');

    // Then: locations page renders
    await expect(page).toHaveURL(/\/admin\/locations/, { timeout: 8000 });
    await expect(
      page.getByRole('heading', { level: 1, name: 'Locations' })
    ).toBeVisible();
  });

  test('clearing the session cookie re-gates protected routes', async ({
    page,
  }) => {
    // Given: user was authenticated and is on the dashboard
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 8000 });

    // When: the session cookie is removed (simulates logout / expiry)
    await page.context().clearCookies();
    await page.goto('/admin/dashboard');

    // Then: redirected back to login
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 8000 });
  });
});
