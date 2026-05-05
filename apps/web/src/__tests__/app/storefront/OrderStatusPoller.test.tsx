import { describe, it, expect } from 'vitest';
import { OrderStatusPoller } from '@/app/(storefront)/order/[id]/OrderStatusPoller';

/**
 * The OrderStatusPoller is a no-op stub post-#362; the component is fully
 * removed in #372 once the new storefront checkout page (#371) lands.
 */
describe('OrderStatusPoller (stubbed post-#362)', () => {
  it('renders nothing', () => {
    expect(OrderStatusPoller()).toBeNull();
  });
});
