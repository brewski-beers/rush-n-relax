/**
 * Checkout-flow E2E — AgeChecker deny (#373).
 *
 * Covers: customer hits Simulate Deny on the verify page → session is
 * cancelled, customer lands on /checkout/cancelled. (Stock release on
 * deny is owned by the AgeChecker webhook in production and the cron in
 * the simulate path; this spec asserts only the customer-visible state.)
 */
import { test, expect } from '@playwright/test';
import { preVerifyAge } from '../fixtures';
import {
  fetchCheckoutSessionFields,
  fillDeliveryDetails,
  preloadCart,
  seedProductWithVariants,
  strField,
  type SeedProductInput,
} from './helpers';

const PRODUCT: SeedProductInput = {
  slug: 'e2e-checkout-deny',
  name: 'E2E Checkout Deny Product',
  variants: [{ variantId: 'default', label: 'Default', price: 1500, qty: 3 }],
};

test.describe('Checkout flow — AgeChecker deny', () => {
  test.beforeAll(async () => {
    await seedProductWithVariants(PRODUCT);
  });

  test('Given a CheckoutSession on the verify page, When the customer fails ID verification, Then the session is cancelled and the customer lands on /checkout/cancelled', async ({
    page,
  }) => {
    // Given: the customer reaches the verify page with a fresh session
    await preVerifyAge(page);
    await preloadCart(page, PRODUCT, 0, 1);
    await page.goto('/cart');
    await fillDeliveryDetails(page);
    await Promise.all([
      page.waitForURL(/\/checkout\/[^/]+\/verify/, { timeout: 15_000 }),
      page.getByRole('button', { name: /^checkout$/i }).click(),
    ]);
    const sessionId = page.url().match(/\/checkout\/([^/]+)\/verify/)?.[1];
    expect(sessionId).toBeTruthy();
    if (!sessionId) throw new Error('unreachable');

    // When: they click Simulate Deny
    await Promise.all([
      page.waitForURL(/\/checkout\/cancelled/, { timeout: 15_000 }),
      page.getByTestId('simulate-deny').click(),
    ]);

    // Then: the session is cancelled
    const sessionFields = await fetchCheckoutSessionFields(sessionId);
    expect(strField(sessionFields, 'status')).toBe('cancelled');
  });
});
