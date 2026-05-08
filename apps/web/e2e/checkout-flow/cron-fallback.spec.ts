/**
 * Checkout-flow E2E — cron fallback (#373).
 *
 * Scenario: the customer never returns to the return URL after paying on
 * Clover. In production the `reconcileCheckoutSessions` scheduled
 * function (functions/index.ts → reconcileCheckoutSessionsImpl) sweeps
 * `awaiting_payment` sessions and promotes them to Orders.
 *
 * The scheduled function cannot be invoked from a Playwright suite, but
 * the customer-side return URL exercises the IDENTICAL finalize pipeline
 * (`finalizeCheckoutSession`) — which is the unit covered by the
 * dedicated functions/reconcile.test.ts + functions/reconciler.test.ts
 * suites and the apps/web/src/__tests__/lib/checkout/finalize.test.ts
 * Vitest specs.
 *
 * Here we exercise the "session is in awaiting_payment, no customer
 * return — system promotes it" by hitting the return URL once the
 * webhook flip has happened, asserting the same outcome the cron
 * delivers: an Order doc keyed by the Clover session id.
 */
import { test, expect } from '@playwright/test';
import {
  createCheckoutSessionViaApi,
  fetchCheckoutSessionFields,
  seedProductWithVariants,
  simulateAgeCheckerWebhookPass,
  strField,
  type SeedProductInput,
} from './helpers';

const PRODUCT: SeedProductInput = {
  slug: 'e2e-checkout-cron',
  name: 'E2E Checkout Cron Product',
  variants: [{ variantId: 'default', label: 'Default', price: 999, qty: 4 }],
};

test.describe('Checkout flow — cron fallback', () => {
  test.beforeAll(async () => {
    await seedProductWithVariants(PRODUCT);
  });

  test('Given a paid CheckoutSession the customer never returns from, When the system finalizes it via the return-URL pipeline, Then the session is promoted to a paid Order', async ({
    request,
    baseURL,
  }) => {
    test.skip(!baseURL, 'baseURL required');

    // Given: a session that has reached awaiting_payment (webhook flipped)
    const { body } = await createCheckoutSessionViaApi(
      request,
      baseURL,
      PRODUCT,
      0,
      1
    );
    const sessionId = body.sessionId;
    expect(sessionId).toBeTruthy();
    if (!sessionId) throw new Error('unreachable');
    await simulateAgeCheckerWebhookPass(sessionId);

    // When: the system-side finalize is invoked (same path the cron uses)
    const returnRes = await request.get(
      `${baseURL}/order/${sessionId}/return`,
      { maxRedirects: 0 }
    );

    // Then: 302 to /order/<orderId> and session is now `completed`
    expect([302, 303, 307, 308]).toContain(returnRes.status());
    const location = returnRes.headers()['location'];
    expect(location).toMatch(/\/order\/[^/?#]+$/);

    const sessionFields = await fetchCheckoutSessionFields(sessionId);
    expect(strField(sessionFields, 'status')).toBe('completed');
    expect(strField(sessionFields, 'orderId')).toBeTruthy();
  });
});
