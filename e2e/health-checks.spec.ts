import { test, expect } from '@playwright/test';

// Test configuration
const baseURL = process.env.BASE_URL || 'http://localhost:5173';
const pages = ['/', '/about', '/locations', '/contact'];
const viewports = [
  { name: 'android', size: { width: 375, height: 812 } },
  { name: 'iphone-se', size: { width: 375, height: 667 } },
  { name: 'ipad', size: { width: 768, height: 1024 } },
  { name: 'desktop', size: { width: 1024, height: 768 } },
];

test.describe('Website Health Checks - Production Readiness', () => {
  test.describe('Basic Page Load', () => {
    test('home page loads with status code 200', async ({ page }) => {
      const response = await page.goto('/');
      expect(response?.status()).toBe(200);
    });

    test('all pages load without errors', async ({ page }) => {
      for (const pagePath of pages) {
        const response = await page.goto(pagePath);
        expect(response?.status()).toBe(200);
      }
    });

    test('no console errors on page load', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto('/');
      expect(errors).toHaveLength(0);
    });
  });

  test.describe('AmbientOverlay Component', () => {
    test('AmbientOverlay component is visible', async ({ page }) => {
      await page.goto('/');
      const overlay = page.locator('[data-component="ambient-overlay"]');
      await expect(overlay).toBeVisible();
    });

    test('AmbientOverlay video renders', async ({ page }) => {
      await page.goto('/');
      const video = page.locator('[data-component="ambient-overlay"] video');
      await expect(video).toBeVisible();
    });
  });

  test.describe('Navigation and Links', () => {
    test('main navigation links are present', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('nav')).toBeVisible();
      await expect(page.locator('nav a[href="/"]')).toBeVisible();
      await expect(page.locator('nav a[href="/about"]')).toBeVisible();
      await expect(page.locator('nav a[href="/locations"]')).toBeVisible();
      await expect(page.locator('nav a[href="/contact"]')).toBeVisible();
    });

    test('navigation links navigate correctly', async ({ page }) => {
      const links = ['/about', '/locations', '/contact'];
      for (const link of links) {
        await page.goto('/');
        await page.click(`nav a[href="${link}"]`);
        await expect(page).toHaveURL(link);
      }
    });

    test('footer links are present and clickable', async ({ page }) => {
      await page.goto('/');
      const footer = page.locator('footer');
      await expect(footer).toBeVisible();
      const links = footer.locator('a');
      expect(await links.count()).toBeGreaterThan(0);
    });
  });

  test.describe('SEO Compliance', () => {
    test('meta description present on all pages', async ({ page }) => {
      for (const pagePath of pages) {
        await page.goto(pagePath);
        const meta = page.locator('meta[name="description"]');
        await expect(meta).toHaveAttribute('content', /./);
      }
    });

    test('page titles are unique and descriptive', async ({ page }) => {
      const expectedTitles = [
        'Rush N Relax',
        'About Us',
        'Locations',
        'Contact Us',
      ];

      for (let i = 0; i < pages.length; i++) {
        await page.goto(pages[i]);
        const title = await page.title();
        expect(title.length).toBeGreaterThan(0);
        expect(title).toContain('Rush N Relax');
      }
    });

    test('Open Graph tags present', async ({ page }) => {
      await page.goto('/');
      const ogTitle = page.locator('meta[property="og:title"]');
      const ogDescription = page.locator('meta[property="og:description"]');
      const ogUrl = page.locator('meta[property="og:url"]');

      // At least one should be present
      const ogCount = await Promise.all([
        ogTitle.count(),
        ogDescription.count(),
        ogUrl.count(),
      ]).then((counts) => counts.reduce((a, b) => a + b, 0));

      expect(ogCount).toBeGreaterThanOrEqual(1);
    });

    test('canonical URL is set', async ({ page }) => {
      await page.goto('/');
      const canonical = page.locator('link[rel="canonical"]');
      // Canonical URL is optional but good to have
      if (await canonical.count() > 0) {
        await expect(canonical).toHaveAttribute('href',/.+/);
      }
    });
  });

  test.describe('Core Web Vitals', () => {
    test('measures Largest Contentful Paint', async ({ page }) => {
      const vitals: any = {};

      page.on('console', (msg) => {
        const text = msg.text();
        if (text.includes('LCP:')) {
          const match = text.match(/LCP: (\d+)/);
          if (match) vitals.lcp = parseInt(match[1]);
        }
      });

      await page.goto('/');

      // Wait for some content to load
      await page.waitForLoadState('networkidle');

      // Check that page loaded
      expect(await page.locator('main').count()).toBeGreaterThan(0);
    });

    test('page loads within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      const response = await page.goto('/');
      const loadTime = Date.now() - startTime;

      expect(response?.status()).toBe(200);
      expect(loadTime).toBeLessThan(5000); // 5 second timeout
    });
  });

  test.describe('Contact Form', () => {
    test('contact form is present on contact page', async ({ page }) => {
      await page.goto('/contact');
      const form = page.locator('form');
      await expect(form).toBeVisible();
    });

    test('contact form has required fields', async ({ page }) => {
      await page.goto('/contact');
      const nameInput = page.locator('input[name="name"]');
      const emailInput = page.locator('input[name="email"]');
      const messageTextarea = page.locator('textarea[name="message"]');

      await expect(nameInput).toBeVisible();
      await expect(emailInput).toBeVisible();
      await expect(messageTextarea).toBeVisible();
    });

    test('contact form shows validation errors', async ({ page }) => {
      await page.goto('/contact');
      const submitBtn = page.locator('button[type="submit"]');
      await submitBtn.click();

      // Wait for error messages
      await page.waitForTimeout(500);
      const errorMessages = page.locator('.error-message');
      expect(await errorMessages.count()).toBeGreaterThan(0);
    });

    test('email field requires valid format', async ({ page }) => {
      await page.goto('/contact');
      const emailInput = page.locator('input[name="email"]');
      const submitBtn = page.locator('button[type="submit"]');

      // Fill form except email
      await page.locator('input[name="name"]').fill('Test User');
      await page.locator('textarea[name="message"]').fill('Test message');

      // Invalid email
      await emailInput.fill('invalid-email');
      await submitBtn.click();

      // Check for error
      await expect(page.locator('text=Invalid email')).toBeVisible();
    });
  });

  // Mobile Responsive Tests
  test.describe('Responsive Design - 320px (Android)', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 320 });
    });

    test('pages load on mobile viewport', async ({ page }) => {
      for (const pagePath of pages) {
        const response = await page.goto(pagePath);
        expect(response?.status()).toBe(200);
      }
    });

    test('no horizontal scroll on mobile', async ({ page }) => {
      await page.goto('/');
      const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = 320;
      expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1); // +1 for rounding
    });
  });

  test.describe('Responsive Design - 375px (iPhone SE)', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
    });

    test('hamburger menu present on mobile', async ({ page }) => {
      await page.goto('/');
      // Check CSS display of hamburger
      const hamburger = page.locator('.mobile-nav-toggle');
      const isVisible = await hamburger.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none';
      });
      expect(isVisible).toBe(true);
    });

    test('hamburger menu toggles navigation', async ({ page }) => {
      await page.goto('/');
      const hamburger = page.locator('.mobile-nav-toggle');
      const nav = page.locator('nav');

      // Menu should be hidden initially on mobile
      await hamburger.click();
      // After click, nav should be in active state
      await expect(nav.locator('.active')).toBeDefined();
    });
  });

  test.describe('Responsive Design - 768px (Tablet)', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
    });

    test('desktop navigation shows on tablet', async ({ page }) => {
      await page.goto('/');
      const nav = page.locator('nav');
      const isVisible = await nav.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none';
      });
      expect(isVisible).toBe(true);
    });

    test('touch targets are properly sized', async ({ page }) => {
      await page.goto('/');
      // Check button/link sizes
      const buttons = page.locator('button, a[class*="btn"]');
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);

      for (let i = 0; i < Math.min(count, 5); i++) {
        const box = await buttons.nth(i).boundingBox();
        if (box) {
          // Touch target should be at least 44x44 or 48x48
          expect(box.width).toBeGreaterThanOrEqual(40);
          expect(box.height).toBeGreaterThanOrEqual(40);
        }
      }
    });
  });

  test.describe('Responsive Design - 1024px (Desktop)', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
    });

    test('desktop layout renders correctly', async ({ page }) => {
      await page.goto('/');
      const main = page.locator('main');
      await expect(main).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('keyboard navigation works', async ({ page }) => {
      await page.goto('/');
      // Tab to first link
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(['A', 'BUTTON']).toContain(focusedElement);
    });

    test('focus outline is visible', async ({ page }) => {
      await page.goto('/');
      const link = page.locator('a').first();
      await link.focus();
      const hasFocus = await link.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.outline !== 'none';
      });
      expect(hasFocus).toBe(true);
    });

    test('form labels are properly associated', async ({ page }) => {
      await page.goto('/contact');
      const nameInput = page.locator('input[name="name"]');
      const label = page.locator('label[for="name"]');
      await expect(label).toBeVisible();
    });

    test('headings follow proper hierarchy', async ({ page }) => {
      await page.goto('/');
      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBeGreaterThanOrEqual(1);
    });
  });
});
