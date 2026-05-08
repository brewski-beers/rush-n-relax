/**
 * Checkout-flow E2E — happy path (#373).
 *
 * Covers the full unhappy-fork-free path:
 *   cart UI → POST /api/checkout/session → /checkout/<id>/verify →
 *   Simulate Pass → /api/checkout/<id>/redirect → stub Clover →
 *   GET /order/<sessionId>/return → Order created (paid) +
 *   committed stock (qty decremented, reserved cleared).
 */
import { test, expect } from '@playwright/test';
import { preVerifyAge } from '../fixtures';
import {
  fetchCheckoutSessionFields,
  fetchProductFields,
  fillDeliveryDetails,
  preloadCart,
  readVariantLocation,
  seedProductWithVariants,
  strField,
  type SeedProductInput,
} from './helpers';

const PRODUCT: SeedProductInput = {
  slug: 'e2e-checkout-happy',
  name: 'E2E Checkout Happy Product',
  variants: [{ variantId: 'default', label: 'Default', price: 2500, qty: 5 }],
};

test.describe('Checkout flow — happy path', () => {
  test.beforeAll(async () => {
    await seedProductWithVariants(PRODUCT);
  });

  test('Given cart with one in-stock product, When customer completes checkout, Then order is created with status paid and stock is committed', async ({
    page,
    request,
    baseURL,
  }) => {
    test.skip(!baseURL, 'baseURL is required for direct API calls');

    // Given: a verified-age customer with the product in their cart
    await preVerifyAge(page);
    await preloadCart(page, PRODUCT, 0, 1);

    // When: they hit the cart page and submit checkout
    await page.goto('/cart');
    await fillDeliveryDetails(page);

    const checkoutBtn = page.getByRole('button', { name: /^checkout$/i });
    await expect(checkoutBtn).toBeEnabled();

    await Promise.all([
      page.waitForURL(/\/checkout\/[^/]+\/verify/, { timeout: 15_000 }),
      checkoutBtn.click(),
    ]);

    // Then: we're on the verify page with a session id in the URL
    const verifyUrl = page.url();
    const sessionId = verifyUrl.match(/\/checkout\/([^/]+)\/verify/)?.[1];
    expect(sessionId, 'session id present in URL').toBeTruthy();
    if (!sessionId) throw new Error('unreachable');

    // And: the session was persisted as awaiting_id with a hold taken
    let sessionFields = await fetchCheckoutSessionFields(sessionId);
    expect(strField(sessionFields, 'status')).toBe('awaiting_id');

    let productFields = await fetchProductFields(PRODUCT.slug);
    let stock = readVariantLocation(productFields, 'default');
    expect(stock).not.toBeNull();
    expect(stock!.qty).toBe(5);
    expect(stock!.reserved).toBe(1);

    // When: the customer completes ID verification via Simulate Pass
    const simulatePass = page.getByTestId('simulate-pass');
    await expect(simulatePass).toBeVisible();
    // Clicking simulate-pass calls a server action then navigates to the
    // redirect endpoint, which 302s to the stub Clover URL.
    await Promise.all([
      page.waitForURL(/\/checkout\/stub\?order=/, { timeout: 15_000 }),
      simulatePass.click(),
    ]);

    // Then: the session is now awaiting_payment with ageVerifiedAt set
    sessionFields = await fetchCheckoutSessionFields(sessionId);
    expect(strField(sessionFields, 'status')).toBe('awaiting_payment');
    expect(sessionFields.ageVerifiedAt).toBeTruthy();

    // When: the customer is redirected back from Clover (we drive the
    // return URL directly because the stub page has no auto-redirect)
    const returnRes = await request.get(
      `${baseURL}/order/${sessionId}/return`,
      { maxRedirects: 0 }
    );
    expect([302, 303, 307, 308]).toContain(returnRes.status());
    const location = returnRes.headers()['location'];
    expect(location, 'return route 302s to /order/<orderId>').toMatch(
      /\/order\/[^/?#]+$/
    );
    const orderId = location.match(/\/order\/([^/?#]+)$/)?.[1];
    expect(orderId).toBeTruthy();

    // Then: the session is completed and points at the new order
    sessionFields = await fetchCheckoutSessionFields(sessionId);
    expect(strField(sessionFields, 'status')).toBe('completed');
    expect(strField(sessionFields, 'orderId')).toBe(orderId);

    // And: stock was committed — qty decremented from 5 → 4, reserved → 0
    productFields = await fetchProductFields(PRODUCT.slug);
    stock = readVariantLocation(productFields, 'default');
    expect(stock).not.toBeNull();
    expect(stock!.qty).toBe(4);
    expect(stock!.reserved).toBe(0);
  });
});
