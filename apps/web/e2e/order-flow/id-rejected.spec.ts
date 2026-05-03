/**
 * Order flow E2E — id_rejected (issue #285).
 *
 * Per the post-#332 cart wiring (CartPage.handleVerifyComplete):
 *   - On a `deny` outcome, the cart sets a checkout error and never calls
 *     /api/order/start. No order doc is written.
 *
 * Assertions:
 *   - The cart shows the rejection reason inline.
 *   - No navigation to /order/<id> happens.
 *   - No POST to /api/order/start fires (network spy).
 *   - The cart still shows the test-mode banner (test-mode foundation).
 */
import { test, expect } from '@playwright/test';
import { preVerifyAge } from '../fixtures';
import {
  fillDeliveryDetails,
  preloadCart,
  seedProductForOrderFlow,
} from './helpers';

const PRODUCT = {
  slug: 'e2e-order-flow-rejected',
  name: 'E2E Rejected Path Product',
  unitPrice: 1500,
  stock: 999,
};

test.describe('Order flow — id_rejected', () => {
  test.beforeAll(async () => {
    await seedProductForOrderFlow(PRODUCT);
  });

  test('simulate deny does not create an order', async ({ page }) => {
    // Given
    await preVerifyAge(page);
    await preloadCart(page, PRODUCT, 1);

    // Spy on /api/order/start — it must NEVER be hit on a deny outcome.
    let orderStartCalls = 0;
    page.on('request', req => {
      if (req.url().includes('/api/order/start')) orderStartCalls += 1;
    });

    await page.goto('/cart');
    await expect(page.getByTestId('test-mode-banner')).toBeVisible();
    await fillDeliveryDetails(page);

    // When: Verify Age → simulate Deny
    await page.getByRole('button', { name: /verify age/i }).click();
    const denyBtn = page.getByRole('button', { name: /simulate deny/i });
    await expect(denyBtn).toBeVisible();
    await denyBtn.click();

    // Then: an inline error is rendered (modal closes; checkoutError set)
    await expect(page.locator('.cart-checkout-error')).toBeVisible();

    // Then: the URL never changed away from /cart
    await expect(page).toHaveURL(/\/cart$/);

    // Then: /api/order/start was never called — give the page a beat to settle
    await page.waitForTimeout(500);
    expect(orderStartCalls).toBe(0);
  });
});
