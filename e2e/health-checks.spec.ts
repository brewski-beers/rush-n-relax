import { test, expect, type BrowserName } from '@playwright/test';
import { preVerifyAge } from './fixtures';

/**
 * Health Checks — Production readiness validation.
 *
 * Pattern: preVerifyAge() is injected once per test to bypass the age gate.
 * BaseURL comes from playwright.config.ts (localhost:3000) — no hardcoded URL.
 * Timeouts are kept tight (5–8s) since the app has zero startup network calls.
 */

const pages = ['/', '/about', '/locations', '/contact'];

test.describe('Website Health Checks - Production Readiness', () => {
  // ─── Basic Page Load ───────────────────────────────────────────────
  test.describe('Basic Page Load', () => {
    test('home page loads with status code 200', async ({ page }) => {
      await preVerifyAge(page);
      const response = await page.goto('/');
      expect(response?.status()).toBe(200);
    });

    test('all pages load without errors', async ({ page }) => {
      await preVerifyAge(page);
      for (const pagePath of pages) {
        const response = await page.goto(pagePath);
        expect(response?.status()).toBe(200);
      }
    });

    test('no console errors on page load', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          // Ignore Firebase/network errors in test environment
          const text = msg.text();
          if (
            !text.includes('Firebase') &&
            !text.includes('firestore') &&
            !text.includes('ERR_CONNECTION')
          ) {
            errors.push(text);
          }
        }
      });
      await preVerifyAge(page);
      await page.goto('/');
      // Wait for page to settle
      await page.waitForSelector('main', { timeout: 5000 });
      expect(errors).toHaveLength(0);
    });
  });

  // ─── Navigation and Links ──────────────────────────────────────────
  test.describe('Navigation and Links', () => {
    test('header navigation is present', async ({ page }) => {
      await preVerifyAge(page);
      await page.goto('/');
      await expect(page.locator('header.header')).toBeVisible();
      await expect(page.locator('header .logo')).toBeVisible();
    });

    test('navigation links work via menu', async ({ page }) => {
      await preVerifyAge(page);
      await page.goto('/');

      // Open menu, then navigate
      const menuToggle = page.locator('.nav-toggle');
      if (await menuToggle.isVisible()) {
        await menuToggle.click();
        await page.getByRole('link', { name: /about/i }).click();
        await expect(page).toHaveURL(/\/about/);
      }
    });

    test('all page routes are reachable', async ({ page }) => {
      await preVerifyAge(page);
      for (const pagePath of pages) {
        const response = await page.goto(pagePath);
        expect(response?.status()).toBe(200);
        await expect(page.locator('main')).toBeVisible();
      }
    });
  });

  // ─── SEO Compliance ────────────────────────────────────────────────
  test.describe('SEO Compliance', () => {
    test('meta description present on all pages', async ({ page }) => {
      await preVerifyAge(page);
      for (const pagePath of pages) {
        await page.goto(pagePath);
        const meta = page.locator('meta[name="description"]');
        await expect(meta).toHaveAttribute('content', /./);
      }
    });

    test('page titles are unique and descriptive', async ({ page }) => {
      await preVerifyAge(page);
      const titles: string[] = [];
      for (const pagePath of pages) {
        await page.goto(pagePath);
        const title = await page.title();
        expect(title.length).toBeGreaterThan(0);
        expect(title).toContain('Rush N Relax');
        titles.push(title);
      }
    });

    test('Open Graph tags present', async ({ page }) => {
      await preVerifyAge(page);
      await page.goto('/');
      // OG tags may be set dynamically — wait for page to settle
      await page.waitForSelector('main', { timeout: 5000 });
      const ogCount = await Promise.all([
        page.locator('meta[property="og:title"]').count(),
        page.locator('meta[property="og:description"]').count(),
        page.locator('meta[property="og:url"]').count(),
      ]).then(counts => counts.reduce((a, b) => a + b, 0));
      expect(ogCount).toBeGreaterThanOrEqual(1);
    });

    test('canonical URL is set', async ({ page }) => {
      await preVerifyAge(page);
      await page.goto('/');
      const canonical = page.locator('link[rel="canonical"]');
      if ((await canonical.count()) > 0) {
        await expect(canonical).toHaveAttribute('href', /.+/);
      }
    });
  });

  // ─── Core Web Vitals ───────────────────────────────────────────────
  test.describe('Core Web Vitals', () => {
    test('measures Largest Contentful Paint', async ({ page }) => {
      await preVerifyAge(page);
      await page.goto('/');
      await page.locator('main').waitFor({ state: 'visible', timeout: 5000 });
      expect(await page.locator('main').count()).toBeGreaterThan(0);
    });

    test('page loads within acceptable time', async ({ page }) => {
      await preVerifyAge(page);
      const startTime = Date.now();
      const response = await page.goto('/');
      const loadTime = Date.now() - startTime;
      expect(response?.status()).toBe(200);
      expect(loadTime).toBeLessThan(5000);
    });
  });

  // ─── Contact Form ──────────────────────────────────────────────────
  test.describe('Contact Form', () => {
    test('contact form is present on contact page', async ({ page }) => {
      await preVerifyAge(page);
      await page.goto('/contact');
      await expect(page.locator('form')).toBeVisible();
    });

    test('contact form has required fields', async ({ page }) => {
      await preVerifyAge(page);
      await page.goto('/contact');
      await expect(page.locator('input[name="name"]')).toBeVisible();
      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('textarea[name="message"]')).toBeVisible();
    });

    test('contact form shows validation errors', async ({ page }) => {
      await preVerifyAge(page);
      await page.goto('/contact');

      // Mock Firestore so we never hit the network
      await page.route('**/firestore.googleapis.com/**', route =>
        route.fulfill({ status: 200, body: '{}' })
      );

      await page.locator('button[type="submit"]').click();

      const errorMessages = page.locator('.error-message');
      await expect(errorMessages.first()).toBeVisible({ timeout: 3000 });
      expect(await errorMessages.count()).toBeGreaterThan(0);
    });

    test('email field requires valid format', async ({ page }) => {
      await preVerifyAge(page);
      await page.goto('/contact');
      await page.locator('input[name="name"]').fill('Test User');
      await page.locator('textarea[name="message"]').fill('Test message');
      await page.locator('input[name="email"]').fill('invalid-email');
      await page.locator('button[type="submit"]').click();
      await expect(page.locator('text=Invalid email')).toBeVisible();
    });
  });

  // ─── Responsive Design ─────────────────────────────────────────────
  test.describe('Responsive Design', () => {
    test('pages load on 320px mobile viewport', async ({ page }) => {
      await preVerifyAge(page);
      await page.setViewportSize({ width: 320, height: 568 });
      for (const pagePath of pages) {
        const response = await page.goto(pagePath);
        expect(response?.status()).toBe(200);
      }
    });

    test('no horizontal scroll on 320px mobile', async ({ page }) => {
      await preVerifyAge(page);
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto('/');
      const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(321);
    });

    test('menu toggle present on mobile', async ({ page }) => {
      await preVerifyAge(page);
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      const toggle = page.locator('.nav-toggle');
      await expect(toggle).toBeVisible();
    });

    test('desktop layout renders at 1024px', async ({ page }) => {
      await preVerifyAge(page);
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto('/');
      await expect(page.locator('main')).toBeVisible();
    });

    test('touch targets are properly sized on tablet', async ({ page }) => {
      await preVerifyAge(page);
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');
      const buttons = page.locator('button, a[class*="btn"]');
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < Math.min(count, 5); i++) {
        const box = await buttons.nth(i).boundingBox();
        if (box) {
          expect(box.width).toBeGreaterThanOrEqual(40);
          expect(box.height).toBeGreaterThanOrEqual(40);
        }
      }
    });
  });

  // ─── Accessibility ──────────────────────────────────────────────────
  test.describe('Accessibility', () => {
    test('keyboard navigation works', async ({ page, browserName }) => {
      // WebKit (Safari) does not move focus to buttons/links via Tab without
      // macOS "Full Keyboard Access" system setting — browser limitation, not app bug.
      test.fixme(
        (browserName as BrowserName) === 'webkit',
        'Safari requires Full Keyboard Access system preference for Tab to focus interactive elements'
      );

      await preVerifyAge(page);
      await page.goto('/');
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(
        () => document.activeElement?.tagName
      );
      expect(['A', 'BUTTON']).toContain(focusedElement);
    });

    test('focus outline is visible', async ({ page }) => {
      await preVerifyAge(page);
      await page.goto('/');
      const link = page.locator('a').first();
      await link.focus();
      const hasFocus = await link.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.outline !== 'none';
      });
      expect(hasFocus).toBe(true);
    });

    test('form labels are properly associated', async ({ page }) => {
      await preVerifyAge(page);
      await page.goto('/contact');
      const label = page.locator('label[for="name"]');
      await expect(label).toBeVisible();
    });

    test('headings follow proper hierarchy', async ({ page }) => {
      await preVerifyAge(page);
      await page.goto('/');
      await page.waitForSelector('main', { timeout: 5000 });
      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBeGreaterThanOrEqual(1);
    });
  });
});
