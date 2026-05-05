import { describe, it, expect } from 'vitest';
import { GET } from '@/app/(storefront)/order/[id]/return/route';

/**
 * The old `/order/[id]/return` handler reconciled `awaiting_payment` orders.
 * Both states it depended on were removed in #362. The replacement
 * (`/api/checkout/[sessionId]/redirect`) lands in #366; full E2E coverage
 * comes back in #373.
 */
describe('GET /order/[id]/return (stubbed post-#362)', () => {
  it('redirects to the storefront root', () => {
    const res = GET();
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
  });
});
