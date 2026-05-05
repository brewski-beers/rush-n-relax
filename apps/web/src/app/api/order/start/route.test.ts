import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/order/start/route';

/**
 * `/api/order/start` was hollowed out in #362 (Order is born only at
 * payment). Full removal happens in #372. Keep one smoke test so the
 * route still has coverage of its 410 contract.
 */
describe('POST /api/order/start (deprecated post-#362)', () => {
  it('returns 410 Gone', () => {
    const res = POST();
    expect(res.status).toBe(410);
  });
});
