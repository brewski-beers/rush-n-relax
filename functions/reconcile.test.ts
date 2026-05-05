import { describe, it, expect } from 'vitest';
import { reconcileAwaitingPaymentOrdersImpl } from './index';

/**
 * The original suite covered Clover Path B reconciliation against
 * `awaiting_payment` orders. That OrderStatus was removed in #362; the
 * reconciler is now a no-op stub until #369 lands the
 * CheckoutSession-based replacement (with its own BDD coverage per #373).
 */
describe('reconcileAwaitingPaymentOrdersImpl (stub post-#362)', () => {
  it('returns zeroed counts without touching Firestore', async () => {
    const result = await reconcileAwaitingPaymentOrdersImpl('M', 'K', 0);
    expect(result).toEqual({ scanned: 0, settled: 0, pending: 0 });
  });
});
