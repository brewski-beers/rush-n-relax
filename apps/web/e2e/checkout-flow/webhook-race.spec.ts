/**
 * Checkout-flow E2E — webhook race scenarios (#373).
 *
 * The verify-page → redirect-handler → Clover hop has two race orderings
 * with the AgeChecker webhook:
 *
 *   A. Webhook lands BEFORE redirect handler — `ageVerifiedAt` is already
 *      set when GET /api/checkout/<id>/redirect executes; the handler
 *      should 302 to Clover immediately, no polling.
 *   B. Webhook lands DURING the redirect handler's poll loop — the
 *      handler observes the field flip and 302s before the timeout.
 *
 * Both branches are exercised against a real CheckoutSession that we
 * create via POST /api/checkout/session, then mutate directly through
 * the emulator REST API to simulate the webhook side effect.
 */
import { test, expect } from '@playwright/test';
import {
  createCheckoutSessionViaApi,
  seedProductWithVariants,
  simulateAgeCheckerWebhookPass,
  type SeedProductInput,
} from './helpers';

const PRODUCT: SeedProductInput = {
  slug: 'e2e-checkout-race',
  name: 'E2E Checkout Race Product',
  variants: [{ variantId: 'default', label: 'Default', price: 1200, qty: 10 }],
};

test.describe('Checkout flow — webhook race', () => {
  test.beforeAll(async () => {
    await seedProductWithVariants(PRODUCT);
  });

  test('Given the AgeChecker webhook lands BEFORE the redirect endpoint is hit, When the redirect handler runs, Then it 302s to the Clover URL immediately', async ({
    request,
    baseURL,
  }) => {
    test.skip(!baseURL, 'baseURL required');

    // Given: a fresh CheckoutSession
    const { status, body } = await createCheckoutSessionViaApi(
      request,
      baseURL,
      PRODUCT,
      0,
      1
    );
    expect(status).toBe(200);
    const sessionId = body.sessionId;
    expect(sessionId).toBeTruthy();
    if (!sessionId) throw new Error('unreachable');

    // And: the webhook lands first — ageVerifiedAt + status flipped
    await simulateAgeCheckerWebhookPass(sessionId);

    // When: the redirect endpoint is called
    const t0 = Date.now();
    const res = await request.get(
      `${baseURL}/api/checkout/${sessionId}/redirect`,
      { maxRedirects: 0 }
    );
    const elapsed = Date.now() - t0;

    // Then: it 302s to the Clover URL with no measurable poll delay
    expect([302, 303, 307, 308]).toContain(res.status());
    expect(res.headers()['location']).toMatch(/\/checkout\/stub\?order=/);
    // Generous: must be well below the default 5_000ms poll deadline.
    expect(elapsed).toBeLessThan(2_000);
  });

  test('Given the redirect endpoint is hit BEFORE the AgeChecker webhook, When the webhook lands during the poll loop, Then the handler observes the flip and 302s to Clover', async ({
    request,
    baseURL,
  }) => {
    test.skip(!baseURL, 'baseURL required');

    // Given: a fresh CheckoutSession (still awaiting_id, no ageVerifiedAt)
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

    // When: redirect kicks off and ~750ms later the webhook lands
    const redirectPromise = request.get(
      `${baseURL}/api/checkout/${sessionId}/redirect`,
      { maxRedirects: 0 }
    );
    await new Promise(r => setTimeout(r, 750));
    await simulateAgeCheckerWebhookPass(sessionId);

    // Then: the handler observes the flip and 302s before the timeout
    const res = await redirectPromise;
    expect([302, 303, 307, 308]).toContain(res.status());
    expect(res.headers()['location']).toMatch(/\/checkout\/stub\?order=/);
  });
});
