import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/checkout/session/route';

/**
 * `/api/checkout/session` was stubbed in #362 because its old contract
 * relied on dropped OrderStatus values (`id_verified` →
 * `awaiting_payment`). The replacement implementation lands in #364 with
 * a full BDD suite (#373).
 */
describe('POST /api/checkout/session (stubbed post-#362)', () => {
  it('returns 410 Gone until #364 rewrites it', () => {
    const res = POST();
    expect(res.status).toBe(410);
  });
});
