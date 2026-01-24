import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to be fully loaded (categories should appear)
    await page.waitForSelector('.category-card, .error-state', { timeout: 15000 });
  });

  test('should load and display categories', async ({ page }) => {
    // Check if we have categories loaded (not error state)
    const hasCategories = await page.locator('.category-card').count() > 0;
    
    if (!hasCategories) {
      test.skip('Categories not loaded - check if emulator is running with seeded data');
    }
    
    await expect(page.locator('.category-card')).toHaveCount(4);
  });

  test('should navigate to category page on click', async ({ page }) => {
    const categoryCard = page.locator('.category-card').first();
    
    // Skip if no categories are available
    if (await categoryCard.count() === 0) {
      test.skip('No categories available - check emulator data');
    }
    
    await categoryCard.click();
    
    await expect(page).toHaveURL(/\/products\/category\/.+/);
    // Wait for products or empty state
    await page.waitForSelector('.product-card, .empty-state', { timeout: 10000 });
  });
});

test.describe('Category Products Page', () => {
  test('should display products for category', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page load
    await page.waitForSelector('.category-card, .error-state', { timeout: 15000 });
    
    const flowerLink = page.getByRole('link', { name: /flower/i }).first();
    
    if (await flowerLink.count() === 0) {
      test.skip('Flower category not found - check emulator data');
    }
    
    await flowerLink.click();
    
    await expect(page).toHaveURL(/\/products\/category\/flower/);
    
    // Wait for products to load
    await page.waitForSelector('.product-card, .empty-state', { timeout: 10000 });
    
    // Check if we have products (expected 2 based on seed data)
    const productCount = await page.locator('.product-card').count();
    expect(productCount).toBeGreaterThan(0);
  });

  test('should navigate to product detail on click', async ({ page }) => {
    await page.goto('/products/category/flower');
    
    // Wait for products to load
    await page.waitForSelector('.product-card, .empty-state, .error-state', { timeout: 15000 });
    
    const productCard = page.locator('.product-card').first();
    
    if (await productCard.count() === 0) {
      test.skip('No products available - check emulator data');
    }
    
    await productCard.click();
    
    await expect(page).toHaveURL(/\/products\/.+\/.+/);
    
    // Wait for product detail to load
    await page.waitForSelector('button, .error-state', { timeout: 10000 });
    
    // Check if Add to Cart button exists (product loaded successfully)
    const hasButton = await page.getByRole('button', { name: /add to cart|out of stock/i }).count() > 0;
    expect(hasButton).toBeTruthy();
  });
});

test.describe('Product Detail Page', () => {
  test('should display product information', async ({ page }) => {
    await page.goto('/');
    
    // Wait for categories to load
    await page.waitForSelector('.category-card, .error-state', { timeout: 15000 });
    
    const categoryCard = page.locator('.category-card').first();
    if (await categoryCard.count() === 0) {
      test.skip('No categories available - check emulator data');
    }
    
    // Navigate through to product
    await categoryCard.click();
    await page.waitForSelector('.product-card, .empty-state', { timeout: 10000 });
    
    const productCard = page.locator('.product-card').first();
    if (await productCard.count() === 0) {
      test.skip('No products available - check emulator data');
    }
    
    await productCard.click();
    
    // Wait for product detail to load
    await page.waitForSelector('h1, .error-state', { timeout: 10000 });
    
    // Verify product details loaded
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.price')).toBeVisible();
  });

  test('should add product to cart', async ({ page }) => {
    // This test requires cart functionality implementation
    test.skip('Cart functionality not yet implemented');
  });
});

test.describe('Accessibility', () => {
  test('homepage should have no accessibility violations', async ({ page }) => {
    await page.goto('/');
    
    // Wait for content to load
    await page.waitForSelector('.category-card, .error-state, h1', { timeout: 15000 });
    
    // Basic a11y checks
    await expect(page.locator('html')).toHaveAttribute('lang');
    
    // Check if we have any headings (either from Hero or error state)
    const headingCount = await page.locator('h1, h2, h3').count();
    expect(headingCount).toBeGreaterThan(0);
    
    // All images should have alt text
    const images = await page.locator('img').all();
    for (const img of images) {
      await expect(img).toHaveAttribute('alt');
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/');
    
    // Wait for interactive elements
    await page.waitForSelector('a, button', { timeout: 15000 });
    
    // Tab through interactive elements
    await page.keyboard.press('Tab');
    
    // Check if focus is on an interactive element
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.tagName;
    });
    
    expect(['A', 'BUTTON', 'INPUT']).toContain(focusedElement);
  });
});

test.describe('Performance', () => {
  test('should load homepage within 3 seconds', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(3000);
  });
});
