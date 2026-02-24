import { test, expect } from '@playwright/test';
import { preVerifyAge } from './fixtures';

/**
 * App E2E Tests — Product browsing, page content, a11y, performance.
 *
 * These tests assume age verification is already complete, so we inject
 * preVerifyAge() to bypass the gate (it's tested elsewhere).
 */

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await preVerifyAge(page);
    await page.goto('/');
    await page.waitForSelector('main', { timeout: 8000 });
  });

  test('should load and display hero section', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.hero')).toBeVisible();
  });

  test('should display product preview cards', async ({ page }) => {
    const productCards = page.locator('.products-preview .rnr-card--product');
    const count = await productCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display location preview cards', async ({ page }) => {
    const locationCards = page.locator(
      '.locations-preview .rnr-card--location'
    );
    const count = await locationCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should navigate to products page from hero CTA', async ({ page }) => {
    await page.getByRole('link', { name: /explore products/i }).click();
    await expect(page).toHaveURL(/\/products/);
  });
});

test.describe('Products Page', () => {
  test('should display all product cards', async ({ page }) => {
    await preVerifyAge(page);
    await page.goto('/products');
    await page.waitForSelector('.rnr-card--product', { timeout: 8000 });

    const productCount = await page.locator('.rnr-card--product').count();
    expect(productCount).toBeGreaterThanOrEqual(5);
  });

  test('should navigate to product detail on click', async ({ page }) => {
    await preVerifyAge(page);
    await page.goto('/products');
    await page.waitForSelector('.rnr-card--product', { timeout: 8000 });

    await page.locator('.rnr-card--product').first().click();
    await expect(page).toHaveURL(/\/products\/.+/);
    await page.waitForSelector('h1', { timeout: 8000 });
    await expect(page.locator('h1')).toBeVisible();
  });
});

test.describe('Product Detail Page', () => {
  test('should display product information', async ({ page }) => {
    await preVerifyAge(page);
    await page.goto('/products/flower');
    await page.waitForSelector('h1', { timeout: 8000 });

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.product-category-badge')).toBeVisible();
    await expect(page.locator('.product-content')).toBeVisible();
  });

  test('should show explore more section with other products', async ({
    page,
  }) => {
    await preVerifyAge(page);
    await page.goto('/products/flower');
    await page.waitForSelector('.related-products', { timeout: 8000 });

    const relatedCards = page.locator('.rnr-card--product-small');
    const count = await relatedCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should navigate between products via explore more', async ({
    page,
  }) => {
    await preVerifyAge(page);
    await page.goto('/products/flower');
    await page.waitForSelector('.related-products', { timeout: 8000 });

    await page.locator('.rnr-card--product-small').first().click();
    await expect(page).not.toHaveURL(/\/products\/flower$/);
    await expect(page.locator('h1')).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test('homepage should have proper heading structure', async ({ page }) => {
    await preVerifyAge(page);
    await page.goto('/');
    await page.waitForSelector('h1', { timeout: 8000 });

    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(1);

    const headingCount = await page.locator('h1, h2, h3').count();
    expect(headingCount).toBeGreaterThan(0);

    const images = await page.locator('img').all();
    for (const img of images) {
      await expect(img).toHaveAttribute('alt');
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    await preVerifyAge(page);
    await page.goto('/');
    await page.waitForSelector('a, button', { timeout: 8000 });

    await page.keyboard.press('Tab');

    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.tagName;
    });
    expect(['A', 'BUTTON', 'INPUT']).toContain(focusedElement);
  });
});

test.describe('Performance', () => {
  test('should load homepage within 3 seconds', async ({ page }) => {
    await preVerifyAge(page);
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForSelector('main, h1', { timeout: 5000 });
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000);
  });
});
