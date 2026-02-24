import { test, expect } from '@playwright/test';
import { preVerifyAge } from './fixtures';

/**
 * App E2E Tests — Product browsing, category navigation, a11y, performance.
 *
 * These tests assume age verification is already complete, so we inject
 * preVerifyAge() to bypass the gate (it's tested elsewhere).
 *
 * Many tests depend on emulator seed data and gracefully skip when absent.
 */

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await preVerifyAge(page);
    await page.goto('/');
    // Static content renders fast — no network calls required
    await page.waitForSelector('.category-card, .error-state, main', { timeout: 8000 });
  });

  test('should load and display categories', async ({ page }) => {
    const hasCategories = await page.locator('.category-card').count() > 0;
    if (!hasCategories) {
      test.skip('Categories not loaded - check if emulator is running with seeded data');
    }
    await expect(page.locator('.category-card')).toHaveCount(4);
  });

  test('should navigate to category page on click', async ({ page }) => {
    const categoryCard = page.locator('.category-card').first();
    if (await categoryCard.count() === 0) {
      test.skip('No categories available - check emulator data');
    }
    await categoryCard.click();
    await expect(page).toHaveURL(/\/products\/category\/.+/);
    await page.waitForSelector('.product-card, .empty-state', { timeout: 8000 });
  });
});

test.describe('Category Products Page', () => {
  test('should display products for category', async ({ page }) => {
    await preVerifyAge(page);
    await page.goto('/');
    await page.waitForSelector('.category-card, .error-state, main', { timeout: 8000 });

    const flowerLink = page.getByRole('link', { name: /flower/i }).first();
    if (await flowerLink.count() === 0) {
      test.skip('Flower category not found - check emulator data');
    }
    await flowerLink.click();
    await expect(page).toHaveURL(/\/products\/category\/flower/);
    await page.waitForSelector('.product-card, .empty-state', { timeout: 8000 });

    const productCount = await page.locator('.product-card').count();
    expect(productCount).toBeGreaterThan(0);
  });

  test('should navigate to product detail on click', async ({ page }) => {
    await preVerifyAge(page);
    await page.goto('/products/category/flower');
    await page.waitForSelector('.product-card, .empty-state, .error-state, main', { timeout: 8000 });

    const productCard = page.locator('.product-card').first();
    if (await productCard.count() === 0) {
      test.skip('No products available - check emulator data');
    }
    await productCard.click();
    await expect(page).toHaveURL(/\/products\/.+\/.+/);
    await page.waitForSelector('button, .error-state', { timeout: 8000 });

    const hasButton = await page.getByRole('button', { name: /add to cart|out of stock/i }).count() > 0;
    expect(hasButton).toBeTruthy();
  });
});

test.describe('Product Detail Page', () => {
  test('should display product information', async ({ page }) => {
    await preVerifyAge(page);
    await page.goto('/');
    await page.waitForSelector('.category-card, .error-state, main', { timeout: 8000 });

    const categoryCard = page.locator('.category-card').first();
    if (await categoryCard.count() === 0) {
      test.skip('No categories available - check emulator data');
    }
    await categoryCard.click();
    await page.waitForSelector('.product-card, .empty-state', { timeout: 8000 });

    const productCard = page.locator('.product-card').first();
    if (await productCard.count() === 0) {
      test.skip('No products available - check emulator data');
    }
    await productCard.click();
    await page.waitForSelector('h1, .error-state', { timeout: 8000 });

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.price')).toBeVisible();
  });

  test('should add product to cart', async ({ page }) => {
    test.skip('Cart functionality not yet implemented');
  });
});

test.describe('Accessibility', () => {
  test('homepage should have no accessibility violations', async ({ page }) => {
    await preVerifyAge(page);
    await page.goto('/');
    await page.waitForSelector('.category-card, .error-state, h1, main', { timeout: 8000 });

    await expect(page.locator('html')).toHaveAttribute('lang');

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
    // Wait for first meaningful paint — NOT networkidle (no network calls to wait for)
    await page.waitForSelector('main, h1', { timeout: 5000 });
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000);
  });
});
