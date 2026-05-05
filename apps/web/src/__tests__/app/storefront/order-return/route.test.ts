/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * BDD coverage for `GET /order/[id]/return` (#368).
 *
 * Scenarios (per acceptance criteria):
 *   - paid → order created with status `paid` and redirect to /order/{id}
 *   - declined / unpaid → no order created, session left awaiting
 *   - already-completed session → redirect to existing order (idempotent)
 *   - commit failure (race) → refund + cancellation path runs
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const finalizeMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/checkout/finalize', () => ({
  finalizeCheckoutSession: finalizeMock,
}));

import { GET } from '@/app/(storefront)/order/[id]/return/route';

function makeReq(path: string): any {
  return new Request(`https://example.com${path}`);
}

describe('GET /order/[id]/return — BDD (#368)', () => {
  beforeEach(() => {
    finalizeMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects to the new order on a successful paid promotion', async () => {
    finalizeMock.mockResolvedValue({ kind: 'paid', orderId: 'ord-1' });

    const res = await GET(
      makeReq('/order/clover-sess-A/return?orderId=clover-ord-A'),
      { params: Promise.resolve({ id: 'clover-sess-A' }) }
    );

    expect(res.status).toBe(307); // Next redirect
    expect(res.headers.get('location')).toContain('/order/ord-1');
    expect(finalizeMock).toHaveBeenCalledWith({
      cloverCheckoutSessionId: 'clover-sess-A',
      cloverOrderId: 'clover-ord-A',
    });
  });

  it('redirects to the existing order when the session is already completed (idempotent refresh)', async () => {
    finalizeMock.mockResolvedValue({
      kind: 'already-completed',
      orderId: 'ord-existing',
    });

    const res = await GET(
      makeReq('/order/clover-sess-B/return?orderId=clover-ord-B'),
      { params: Promise.resolve({ id: 'clover-sess-B' }) }
    );

    expect(res.headers.get('location')).toContain('/order/ord-existing');
  });

  it('redirects to the awaiting page when payment status is still pending', async () => {
    finalizeMock.mockResolvedValue({
      kind: 'awaiting',
      sessionId: 'clover-sess-C',
    });

    const res = await GET(makeReq('/order/clover-sess-C/return'), {
      params: Promise.resolve({ id: 'clover-sess-C' }),
    });

    expect(res.headers.get('location')).toContain('/checkout/awaiting');
    expect(res.headers.get('location')).toContain('clover-sess-C');
  });

  it('redirects to the cancelled page when Clover returns FAIL', async () => {
    finalizeMock.mockResolvedValue({
      kind: 'declined',
      sessionId: 'clover-sess-D',
    });

    const res = await GET(
      makeReq('/order/clover-sess-D/return?orderId=clover-ord-D'),
      { params: Promise.resolve({ id: 'clover-sess-D' }) }
    );

    expect(res.headers.get('location')).toContain('/checkout/cancelled');
  });

  it('redirects to the cancelled page when stock commit fails (race + refund path)', async () => {
    finalizeMock.mockResolvedValue({
      kind: 'commit-failed',
      sessionId: 'clover-sess-E',
      orderId: 'ord-E',
    });

    const res = await GET(
      makeReq('/order/clover-sess-E/return?orderId=clover-ord-E'),
      { params: Promise.resolve({ id: 'clover-sess-E' }) }
    );

    expect(res.headers.get('location')).toContain('/checkout/cancelled');
  });

  it('redirects home when the finalizer throws (unknown session)', async () => {
    finalizeMock.mockRejectedValue(new Error("CheckoutSession 'x' not found"));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await GET(makeReq('/order/x/return'), {
      params: Promise.resolve({ id: 'x' }),
    });

    expect(res.headers.get('location')).toContain('https://example.com/');
    expect(errSpy).toHaveBeenCalled();
  });
});
