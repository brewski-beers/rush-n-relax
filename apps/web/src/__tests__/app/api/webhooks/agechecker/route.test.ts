import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/webhooks/agechecker/route';

/**
 * NOTE: The previous suite covered the old AgeChecker → OrderStatus webhook
 * (drove `pending_id_verification → id_verified | id_rejected`). Both target
 * states were removed in #362. The new webhook (writes
 * `CheckoutSession.ageVerifiedAt`) lands in #367 with a fresh BDD suite per
 * #373. This file keeps a single smoke check so the route stays imported.
 */
describe('agechecker webhook (stubbed post-#362)', () => {
  it('returns deprecated marker', async () => {
    const res = POST();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { deprecated?: boolean };
    expect(body.deprecated).toBe(true);
  });
});
