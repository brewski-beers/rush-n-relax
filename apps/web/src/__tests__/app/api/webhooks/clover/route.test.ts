import { describe, expect, it } from 'vitest';
import { POST } from '@/app/api/webhooks/clover/route';

describe('POST /api/webhooks/clover (Path B no-op stub)', () => {
  it('returns 200 with handled=false for any inbound POST', async () => {
    const res = POST();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { received: boolean; handled: boolean };
    expect(body).toEqual({ received: true, handled: false });
  });
});
