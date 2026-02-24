import { test, expect } from '@playwright/test';
import { verifyAge, preVerifyAge } from './fixtures';

/**
 * User Journey E2E Tests
 *
 * Tests REAL user flows through the app — navigation, page transitions,
 * and post-verification interactions. Age-gate validation logic is NOT
 * retested here (see age-gate.spec.ts for that).
 *
 * Pattern: Use preVerifyAge() when age-gate isn't the thing under test.
 *          Use verifyAge() only when testing the gate→app transition.
 */

test.describe('Full User Journey - E2E', () => {
  test('user can verify age and browse the site', async ({ page }) => {
    await page.goto('/');

    // Age gate → main app transition (only journey test that uses the UI gate)
    await verifyAge(page);

    // Navigation should be visible post-verification
    await expect(page.locator('header')).toBeVisible();

    // Navigate to products via page link
    await page.getByRole('link', { name: /explore products/i }).click();
    await expect(page).toHaveURL(/\/products/);
  });

  test('verified user can navigate all pages via menu', async ({ page }) => {
    await preVerifyAge(page);
    await page.goto('/');

    // Open the menu first (nav links are in mobile drawer)
    const toggle = page.locator('.nav-toggle');

    // About
    await toggle.click();
    await page.getByRole('link', { name: /about/i }).click();
    await expect(page).toHaveURL(/\/about/);

    // Locations
    await toggle.click();
    await page.getByRole('link', { name: /locations/i }).click();
    await expect(page).toHaveURL(/\/locations/);

    // Contact
    await toggle.click();
    await page.getByRole('link', { name: /contact/i }).click();
    await expect(page).toHaveURL(/\/contact/);

    // Home (via logo)
    await page.locator('header .logo').click();
    await expect(page).toHaveURL('/');
  });

  test('contact page displays form', async ({ page }) => {
    await preVerifyAge(page);
    await page.goto('/contact');

    const form = page.locator('form').first();
    await expect(form).toBeVisible();
  });

  test('locations page loads', async ({ page }) => {
    await preVerifyAge(page);
    await page.goto('/locations');

    // Page content should render
    await expect(page.locator('main')).toBeVisible();
  });

  test('header is visible on all pages', async ({ page }) => {
    await preVerifyAge(page);

    for (const path of ['/', '/about', '/locations', '/contact']) {
      await page.goto(path);
      await expect(page.locator('header.header')).toBeVisible();
    }
  });

  test('logo renders in header', async ({ page }) => {
    await preVerifyAge(page);
    await page.goto('/');

    // Logo link has either an img or text fallback
    const headerLogo = page.locator('header .logo');
    await expect(headerLogo).toBeVisible();
  });
});
