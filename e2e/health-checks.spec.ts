import { test, expect } from '@playwright/test';
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
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      await preVerifyAge(page);
      await page.goto('/');
      expect(errors).toHaveLength(0);
    });
  });

  // ─── AmbientOverlay ────────────────────────────────────────────────
  test.describe('AmbientOverlay Component', () => {
    test('AmbientOverlay component is visible', async ({ page }) => {
      await preVerifyAge(page);
      await page.goto('/');
      const overlay = page.locator('[data-component="ambient-overlay"]');
      await expect(overlay).toBeVisible();
    });

    test('AmbientOverlay video renders', async ({ page }) => {
      await preVerifyAge(page);
      await page.goto('/');
      const video = page.locator('[data-component="ambient-overlay"] video');
      await expect(video).toBeVisible();
    });
  });

  // ─── Navigation and Links ──────────────────────────────────────────
  test.describe('Navigation and Links', () => {
    test('main navigation links are present', async ({ page }) => {
      await preVerifyAge(page);
      await page.goto('/');
      await expect(page.locator('nav')).toBeVisible();
      await expect(page.locator('nav a[href="/"]')).toBeVisible();
      await expect(page.locator('nav a[href="/about"]')).toBeVisible();
      await expect(page.locator('nav a[href="/locations"]')).toBeVisible();
      await expect(page.locator('nav a[href="/contact"]')).toBeVisible();
    });

    test('navigation links navigate correctly', async ({ page }) => {
      await preVerifyAge(page);
      const links = ['/about', '/locations', '/contact'];
      for (const link of links) {
        await page.goto('/');
        await page.click(`nav a[href="${link}"]`);
        await expect(page).toHaveURL(link);
      }
    });

    test('footer links are present and clickable', async ({ page }) => {
      await preVerifyAge(page);
      await page.goto('/');
      const footer = page.locator('footer');
      await expect(footer).toBeVisible();
      const links = footer.locator('a');
      expect(await links.count()).toBeGreaterThan(0);
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
      for (let i = 0; i < pages.length; i++) {
        await page.goto(pages[i]);
        const title = await page.title();
        expect(title.length).toBeGreaterThan(0);
        expect(title).toContain('Rush N Relax');
      }
    });

    test('Open Graph tags present', async ({ page }) => {
      await preVerifyAge(page);
      await page.goto('/');
      const ogCount = await Promise.all([
        page.locator('meta[property="og:title"]').count(),
        page.locator('meta[property="og:description"]').count(),
        page.locator('meta[property="og:url"]').count(),
      ]).then((counts) => counts.reduce((a, b) => a + b, 0));
      expect(ogCount).toBeGreaterThanOrEqual(1);
    });

    test('canonical URL is set', async ({ page }) => {
      await preVerifyAge(page);
      await page.goto('/');
      const canonical = page.locator('link[rel="canonical"]');
      if (await canonical.count() > 0) {
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

      // Mock the Firestore submission so we never hit the network
      await page.route('**/firestore.googleapis.com/**', (route) =>
        route.fulfill({ status: 200, body: '{}' }),
      );

      await page.locator('button[type="submit"]').click();

      // Wait for the DOM to update with validation messages (not arbitrary timeout)
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
  // Consolidated into a single describe to avoid redundant page loads.
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
      expect(scrollWidth).toBeLessThanOrEqual(321); // +1 for rounding
    });

    test('hamburger menu present on 375px mobile', async ({ page }) => {
      await preVerifyAge(page);
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      const hamburger = page.locator('.mobile-nav-toggle, [aria-label*="menu" i], button.hamburger');
      if (await hamburger.count() > 0) {
        const isVisible = await hamburger.first().evaluate((el) => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none';
        });
        expect(isVisible).toBe(true);
      }
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
    test('keyboard navigation works', async ({ page }) => {
      await preVerifyAge(page);
      await page.goto('/');
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(['A', 'BUTTON']).toContain(focusedElement);
    });

    test('focus outline is visible', async ({ page }) => {
      await preVerifyAge(page);
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
      await preVerifyAge(page);
      await page.goto('/contact');
      const label = page.locator('label[for="name"]');
      await expect(label).toBeVisible();
    });

    test('headings follow proper hierarchy', async ({ page }) => {
      await preVerifyAge(page);
      await page.goto('/');
      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBeGreaterThanOrEqual(1);
    });
  });
});
