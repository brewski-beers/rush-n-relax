/**
 * Checkout-flow E2E — payment cancelled (#373).
 *
 * In dev / preview the live-payments kill switch (#411 / lib/test-mode.ts)
 * is OFF, so `createCloverCheckoutSession` returns the local stub and
 * `finalizeCheckoutSession` always synthesizes a SUCCESS outcome when
 * no Clover order id is present. There is no "decline" UX path to drive
 * end-to-end without real Clover credentials.
 *
 * The Clover-decline branch IS covered at the unit level:
 *   apps/web/src/__tests__/lib/checkout/finalize.test.ts
 *     "FAIL outcome → marks session cancelled, returns declined"
 *
 * If/when a sandbox-Clover E2E mode is added, replace this skip with a
 * real flow that lands on /checkout/cancelled and asserts:
 *   - session.status === 'cancelled'
 *   - no Order doc was created
 *   - holds eventually released by the reconciler
 */
import { test } from '@playwright/test';

test.describe('Checkout flow — payment cancelled', () => {
  test.skip('Given the customer abandons Clover checkout, When they hit /order/<id>/return with a declined payment, Then the session is marked cancelled and no order is created — covered by finalize.test.ts unit suite; awaits sandbox-Clover E2E mode', () => {
    // intentionally empty — see file header
  });
});
