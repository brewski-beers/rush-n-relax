/**
 * Order flow E2E — happy path (issue #285).
 *
 * Drives the cart all the way through:
 *   cart → delivery details (TN, shippable) → Verify Age → simulate Pass
 *   → POST /api/order/start → /order/[id] → POST /api/checkout/session →
 *   simulated `payment.succeeded` Clover webhook → status `paid`.
 *
 * The /api/checkout/session call mirrors what OrderStatusPoller does on the
 * client. We drive it directly because the storefront's automatic Clover
 * redirect is timing-sensitive in a headless run; the contract under test is
 * the order lifecycle, not the polling cadence.
 *
 * Also asserts the test-mode banner and the `testMode: true` flag on the
 * created order, and that the admin orders detail page renders the TEST
 * badge (issues #328 / #329 — test-mode foundation).
 */
import { test, expect } from '@playwright/test';
import { preVerifyAge, establishAdminSession } from '../fixtures';
import {
  DEFAULT_DELIVERY,
  fetchOrderFields,
  fillDeliveryDetails,
  orderIdFromUrl,
  postCloverWebhook,
  preloadCart,
  seedProductForOrderFlow,
} from './helpers';

const PRODUCT = {
  slug: 'e2e-order-flow-happy',
  name: 'E2E Happy Path Product',
  unitPrice: 2500,
  stock: 999,
};

test.describe('Order flow — happy path', () => {
  test.beforeAll(async () => {
    await seedProductForOrderFlow(PRODUCT);
  });

  test('cart → verify age (pass) → stub checkout → webhook paid → order shows confirmed', async ({
    page,
    request,
    baseURL,
  }) => {
    test.skip(!baseURL, 'baseURL is required for direct API + webhook POSTs');

    // Given: a verified-age customer with a single in-stock item in their cart
    await preVerifyAge(page);
    await preloadCart(page, PRODUCT, 1);

    // When: they land on the cart page
    await page.goto('/cart');

    // Then: the test-mode banner is visible (live payments kill switch off)
    await expect(page.getByTestId('test-mode-banner')).toBeVisible();

    // When: they fill in valid delivery details for a shippable state (TN)
    await fillDeliveryDetails(page);

    // Then: the Verify Age button is enabled
    const verifyBtn = page.getByRole('button', { name: /verify age/i });
    await expect(verifyBtn).toBeEnabled();

    // When: they click Verify Age and simulate a passing ID check
    await verifyBtn.click();
    const simulatePass = page.getByRole('button', { name: /simulate pass/i });
    await expect(simulatePass).toBeVisible();

    // The cart calls window.location.assign('/order/<id>') on a successful
    // POST. Wait for the URL to change so we can capture the order id.
    await Promise.all([
      page.waitForURL(/\/order\/[^/?#]+/, { timeout: 15000 }),
      simulatePass.click(),
    ]);

    const orderId = orderIdFromUrl(page.url());
    expect(orderId, 'order id should appear in /order/<id> URL').toBeTruthy();
    if (!orderId) throw new Error('unreachable');

    // Then: the order page shows the test-mode banner
    await expect(page.getByTestId('test-mode-banner')).toBeVisible();

    // Then: the persisted order is `id_verified` and tagged testMode: true
    let fields = await fetchOrderFields(orderId);
    expect((fields.status as { stringValue?: string })?.stringValue).toBe(
      'id_verified'
    );
    expect((fields.testMode as { booleanValue?: boolean })?.booleanValue).toBe(
      true
    );

    // When: the storefront-side checkout session is opened (this mirrors
    // what OrderStatusPoller does client-side; we drive it directly to
    // keep the assertion deterministic).
    const sessionRes = await request.post(`${baseURL}/api/checkout/session`, {
      data: { orderId },
    });
    expect(sessionRes.status()).toBe(200);
    const sessionBody = (await sessionRes.json()) as {
      redirectUrl: string;
      provider: string;
    };
    expect(sessionBody.provider).toBe('stub');
    expect(sessionBody.redirectUrl).toMatch(/\/checkout\/stub\?order=/);

    // When: the customer lands on the Clover stub page
    await page.goto(sessionBody.redirectUrl);
    await expect(page.getByTestId('test-mode-banner')).toBeVisible();

    // When: the Clover webhook simulates a successful payment
    await postCloverWebhook(request, baseURL, {
      type: 'payment.succeeded',
      data: { orderId, paymentId: `e2e-pay-${Date.now()}` },
    });

    // Then: the persisted order is `paid`
    fields = await fetchOrderFields(orderId);
    expect((fields.status as { stringValue?: string })?.stringValue).toBe(
      'paid'
    );

    // When: returning to the order page
    await page.goto(`/order/${orderId}`);

    // Then: the customer sees the confirmation copy for an in-progress order
    await expect(
      page.getByRole('heading', { name: /order confirmed/i })
    ).toBeVisible();
    await expect(page.getByText(/current status/i)).toBeVisible();
  });

  test('admin orders detail page shows the TEST badge for the seeded order', async ({
    page,
    request,
    baseURL,
  }) => {
    test.skip(!baseURL, 'baseURL is required for direct API + webhook POSTs');

    // Given: a fresh order pushed all the way to `paid` via the same flow.
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

    const sessionRes = await request.post(`${baseURL}/api/checkout/session`, {
      data: { orderId },
    });
    expect(sessionRes.status()).toBe(200);
    await postCloverWebhook(request, baseURL, {
      type: 'payment.succeeded',
      data: { orderId, paymentId: `e2e-pay-${Date.now()}` },
    });

    // When: an admin opens the order detail page
    await page.goto('/admin/login');
    await establishAdminSession(page);
    await page.goto(`/admin/orders/${orderId}`);

    // Then: the TEST badge is rendered (testMode-tagged order)
    await expect(page.getByTestId('test-badge')).toBeVisible();
  });

  // Reference value to keep DEFAULT_DELIVERY exported and used.
  test('default delivery fixture targets a shippable state', () => {
    expect(DEFAULT_DELIVERY.state).toBe('TN');
  });
});
