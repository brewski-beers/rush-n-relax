import { test, expect } from '@playwright/test';
import { preVerifyAge } from './fixtures';

/**
 * Reviews E2E Tests
 *
 * Verifies that the ReviewsSection renders correctly on location detail pages
 * using data read directly from Firestore (seeded by scripts/seed-emulators.cjs).
 *
 * Seeded data:
 *   Oak Ridge  — rating 4.8, 312 reviews, 5 cards (Jane D., Marcus H., Patricia L., Ryan K., Sandra W.)
 *   Seymour    — rating 4.7, 198 reviews, 5 cards (Mark T., Angela R., Derek S., Karen M., Tony B.)
 *   Maryville  — no placeId → no reviews section rendered
 */

test.describe('Reviews section on location detail pages', () => {
  test.beforeEach(async ({ page }) => {
    await preVerifyAge(page);
  });

  test.describe('Oak Ridge location', () => {
    test('renders the "What Customers Are Saying" heading', async ({
      page,
    }) => {
      await page.goto('/locations/oak-ridge');
      await expect(page.locator('.location-reviews-section h2')).toHaveText(
        'What Customers Are Saying'
      );
    });

    test('displays the correct aggregate rating', async ({ page }) => {
      await page.goto('/locations/oak-ridge');
      await expect(page.locator('.reviews-rating-number')).toHaveText('4.8');
    });

    test('displays the correct review count', async ({ page }) => {
      await page.goto('/locations/oak-ridge');
      await expect(page.locator('.reviews-count')).toContainText('312');
    });

    test('renders exactly 5 review cards', async ({ page }) => {
      await page.goto('/locations/oak-ridge');
      await expect(page.locator('.reviews-grid .review-author')).toHaveCount(5);
    });

    test('renders all 5 author names in order', async ({ page }) => {
      await page.goto('/locations/oak-ridge');
      const authors = page.locator('.reviews-grid .review-author');
      await expect(authors.nth(0)).toHaveText('Jane D.');
      await expect(authors.nth(1)).toHaveText('Marcus H.');
      await expect(authors.nth(2)).toHaveText('Patricia L.');
      await expect(authors.nth(3)).toHaveText('Ryan K.');
      await expect(authors.nth(4)).toHaveText('Sandra W.');
    });

    test('includes a link to read all reviews on Google', async ({ page }) => {
      await page.goto('/locations/oak-ridge');
      const link = page.locator('.reviews-google-link');
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href', /google\.com\/maps/);
      await expect(link).toHaveAttribute('target', '_blank');
    });

    test('star rating is accessible with aria-label', async ({ page }) => {
      await page.goto('/locations/oak-ridge');
      await expect(
        page.locator('.reviews-summary .reviews-stars')
      ).toHaveAttribute('aria-label', /4\.8 out of 5 stars/);
    });
  });

  test.describe('Seymour location', () => {
    test('displays the correct aggregate rating', async ({ page }) => {
      await page.goto('/locations/seymour');
      await expect(page.locator('.reviews-rating-number')).toHaveText('4.7');
    });

    test('displays the correct review count', async ({ page }) => {
      await page.goto('/locations/seymour');
      await expect(page.locator('.reviews-count')).toContainText('198');
    });

    test('renders exactly 5 review cards', async ({ page }) => {
      await page.goto('/locations/seymour');
      await expect(page.locator('.reviews-grid .review-author')).toHaveCount(5);
    });

    test('renders all 5 author names in order', async ({ page }) => {
      await page.goto('/locations/seymour');
      const authors = page.locator('.reviews-grid .review-author');
      await expect(authors.nth(0)).toHaveText('Mark T.');
      await expect(authors.nth(1)).toHaveText('Angela R.');
      await expect(authors.nth(2)).toHaveText('Derek S.');
      await expect(authors.nth(3)).toHaveText('Karen M.');
      await expect(authors.nth(4)).toHaveText('Tony B.');
    });
  });

  test.describe('Maryville location (no placeId)', () => {
    test('does not render the reviews section', async ({ page }) => {
      await page.goto('/locations/maryville');
      await expect(
        page.locator('.location-reviews-section')
      ).not.toBeAttached();
    });

    test('does not show a loading spinner', async ({ page }) => {
      await page.goto('/locations/maryville');
      await expect(page.locator('.reviews-spinner')).not.toBeAttached();
    });
  });

  test.describe('Review card content', () => {
    test('first Oak Ridge card shows correct review text', async ({ page }) => {
      await page.goto('/locations/oak-ridge');
      await expect(
        page.locator('.reviews-grid .review-text').nth(0)
      ).toContainText('Incredible selection and knowledgeable staff');
    });

    test('first Oak Ridge card shows correct time description', async ({
      page,
    }) => {
      await page.goto('/locations/oak-ridge');
      await expect(
        page.locator('.reviews-grid .review-time').nth(0)
      ).toContainText('2 days ago');
    });

    test('all review cards have 5-star ratings', async ({ page }) => {
      await page.goto('/locations/oak-ridge');
      const stars = page.locator('.reviews-grid .reviews-stars');
      await expect(stars).toHaveCount(5);
      for (let i = 0; i < 5; i++) {
        await expect(stars.nth(i)).toHaveAttribute(
          'aria-label',
          /5 out of 5 stars/
        );
      }
    });

    test('review cards are rendered as a list with role="list"', async ({
      page,
    }) => {
      await page.goto('/locations/oak-ridge');
      await expect(page.locator('.reviews-grid[role="list"]')).toBeVisible();
    });
  });

  test.describe('Loading and error states', () => {
    test('does not show a loading spinner once data is rendered', async ({
      page,
    }) => {
      await page.goto('/locations/oak-ridge');
      await expect(page.locator('.reviews-rating-number')).toBeVisible();
      await expect(page.locator('.reviews-spinner')).not.toBeAttached();
    });
  });
});
