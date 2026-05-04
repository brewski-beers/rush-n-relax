/**
 * Order flow E2E — payment_failed + state-gate (issue #285).
 *
 * payment_failed: drive the cart through a successful ID check, advance the
 * order through the storefront `/api/checkout/session` (the same call the
 * OrderStatusPoller would issue client-side), then POST a `payment.failed`
 * Clover webhook directly. Order should transition to `failed` and the
 * order page should render the failed-state copy.
 *
 * State-gate (issue #331): assert that picking a blocked state in the cart
 * disables the option in the UI, AND that a server-side POST mutating the
 * state to a blocked code returns 422 (defense in depth).
 */
import { test, expect } from '@playwright/test';
import { preVerifyAge } from '../fixtures';
import {
  fetchOrderFields,
  fillDeliveryDetails,
  orderIdFromUrl,
  postCloverWebhook,
  preloadCart,
  seedProductForOrderFlow,
} from './helpers';

const PRODUCT = {
  slug: 'e2e-order-flow-failed',
  name: 'E2E Failed Path Product',
  unitPrice: 3000,
  stock: 999,
};

test.describe('Order flow — payment_failed', () => {
  test.beforeAll(async () => {
    await seedProductForOrderFlow(PRODUCT);
  });

  test('payment.failed webhook transitions the order to failed', async ({
    page,
    request,
    baseURL,
  }) => {
    test.skip(!baseURL, 'baseURL is required for direct API + webhook POSTs');

    // Given: a customer who passes ID and lands on the order page.
    await preVerifyAge(page);
    await preloadCart(page, PRODUCT, 1);
    await page.goto('/cart');
    await fillDeliveryDetails(page);
    await page.getByRole('button', { name: /verify age/i }).click();
    await Promise.all([
      page.waitForURL(/\/order\/[^/?#]+/, { timeout: 15000 }),
      page.getByRole('button', { name: /simulate pass/i }).click(),
    ]);
    const orderId = orderIdFromUrl(page.url());
    if (!orderId) throw new Error('order id not captured');

    // When: the storefront opens its Clover session (mirrors the poller).
    const sessionRes = await request.post(`${baseURL}/api/checkout/session`, {
      data: { orderId },
    });
    expect(sessionRes.status()).toBe(200);

    // When: the Clover webhook reports a payment failure
    await postCloverWebhook(request, baseURL, {
      type: 'payment.failed',
      data: { orderId },
    });

    // Then: the persisted order is `failed`
    const fields = await fetchOrderFields(orderId);
    expect((fields.status as { stringValue?: string })?.stringValue).toBe(
      'failed'
    );

    // Then: returning to /order/<id> shows the failed-state copy
    await page.goto(`/order/${orderId}`);
    await expect(
      page.getByRole('heading', { name: /payment failed/i })
    ).toBeVisible();
    await expect(page.getByTestId('test-mode-banner')).toBeVisible();
  });
});

test.describe('Order flow — state gate (issue #331)', () => {
  test.beforeAll(async () => {
    await seedProductForOrderFlow(PRODUCT);
  });

  test('blocked state option is disabled in the cart', async ({ page }) => {
    await preVerifyAge(page);
    await preloadCart(page, PRODUCT, 1);
    await page.goto('/cart');

    // Colorado is blocked per src/constants/shipping.ts. The form renders
    // it as a <option disabled> — selectOption() will throw if it tries to
    // pick a disabled option, which is the assertion we want.
    const stateSelect = page.getByLabel(/state/i);
    await expect(stateSelect).toBeVisible();
    await expect(
      stateSelect.locator('option[value="CO"]')
    ).toHaveAttribute('disabled', '');
  });

  test('server returns 422 if a blocked state is POSTed to /api/order/start', async ({
    request,
    baseURL,
  }) => {
    test.skip(!baseURL, 'baseURL is required');

    const res = await request.post(`${baseURL}/api/order/start`, {
      data: {
        verificationId: 'e2e-state-gate',
        items: [
          {
            productId: PRODUCT.slug,
            productName: PRODUCT.name,
            quantity: 1,
            unitPrice: PRODUCT.unitPrice,
            lineTotal: PRODUCT.unitPrice,
          },
        ],
        subtotal: PRODUCT.unitPrice,
        tax: 0,
        total: PRODUCT.unitPrice,
        locationId: 'online',
        deliveryAddress: {
          name: 'Blocked State',
          line1: '1 Blocked Way',
          city: 'Denver',
          state: 'CO',
          zip: '80202',
        },
        customerEmail: 'blocked@example.com',
      },
    });

    expect(res.status()).toBe(422);
  });
});
