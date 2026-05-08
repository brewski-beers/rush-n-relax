/**
 * Checkout-flow E2E — shortage at hold time (#373).
 *
 * Covers: when the cart's requested quantity exceeds available stock,
 * POST /api/checkout/session returns 409 and no session doc is created.
 * Reserved-stock counter is unchanged (defense-in-depth assertion).
 */
import { test, expect } from '@playwright/test';
import {
  createCheckoutSessionViaApi,
  fetchProductFields,
  readVariantLocation,
  seedProductWithVariants,
  type SeedProductInput,
} from './helpers';

const PRODUCT: SeedProductInput = {
  slug: 'e2e-checkout-shortage',
  name: 'E2E Checkout Shortage Product',
  // qty=0 — every checkout request must fail at hold time.
  variants: [{ variantId: 'default', label: 'Default', price: 1000, qty: 0 }],
};

test.describe('Checkout flow — shortage at hold time', () => {
  test.beforeAll(async () => {
    await seedProductWithVariants(PRODUCT);
  });

  test('Given a product with zero available stock, When POST /api/checkout/session is called, Then it returns 409 and no holds are taken', async ({
    request,
    baseURL,
  }) => {
    test.skip(!baseURL, 'baseURL is required for direct API calls');

    // When: a session is requested for the out-of-stock product
    const { status, body } = await createCheckoutSessionViaApi(
      request,
      baseURL,
      PRODUCT,
      0,
      1
    );

    // Then: the API returns 409 with the shortage detail
    expect(status).toBe(409);
    expect(body.error).toMatch(/insufficient/i);
    expect(body.productId).toBe(PRODUCT.slug);
    expect(body.requested).toBe(1);
    expect(body.available).toBe(0);
    expect(body.sessionId).toBeUndefined();

    // And: reserved stock is unchanged (no leak)
    const productFields = await fetchProductFields(PRODUCT.slug);
    const stock = readVariantLocation(productFields, 'default');
    expect(stock).not.toBeNull();
    expect(stock!.qty).toBe(0);
    expect(stock!.reserved).toBe(0);
  });
});
