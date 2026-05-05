import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getCheckoutSessionMock } = vi.hoisted(() => ({
  getCheckoutSessionMock: vi.fn(),
}));

vi.mock('@/lib/repositories/checkout-session.repository', () => ({
  getCheckoutSession: getCheckoutSessionMock,
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/checkout/[sessionId]/redirect/route';
import type { CheckoutSession } from '@/types/checkout-session';

const CLOVER_URL = 'https://clover.com/checkout/abc';
const SESSION_ID = 'sess_abc';

function baseSession(over: Partial<CheckoutSession> = {}): CheckoutSession {
  const now = new Date();
  return {
    id: SESSION_ID,
    items: [],
    subtotal: 0,
    tax: 0,
    total: 0,
    locationId: 'online',
    deliveryAddress: {
      name: 'Jane',
      line1: '1 Main',
      city: 'Knoxville',
      state: 'TN',
      zip: '37902',
    },
    status: 'awaiting_id',
    ageVerifiedAt: null,
    verificationId: null,
    holds: [],
    cloverCheckoutSessionId: SESSION_ID,
    cloverCheckoutUrl: CLOVER_URL,
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + 60_000),
    ...over,
  };
}

function makeReq(): NextRequest {
  return new NextRequest(
    `http://localhost/api/checkout/${SESSION_ID}/redirect`
  );
}

function ctx() {
  return { params: Promise.resolve({ sessionId: SESSION_ID }) };
}

describe('GET /api/checkout/[sessionId]/redirect — webhook race (#366)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    delete process.env.CHECKOUT_REDIRECT_TIMEOUT_MS;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('redirects immediately when webhook landed first (ageVerifiedAt set)', async () => {
    getCheckoutSessionMock.mockResolvedValueOnce(
      baseSession({
        status: 'awaiting_payment',
        ageVerifiedAt: new Date(),
        verificationId: 'v1',
      })
    );
    const res = await GET(makeReq(), ctx());
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(CLOVER_URL);
    expect(getCheckoutSessionMock).toHaveBeenCalledTimes(1);
  });

  it('redirects on first observed value when webhook arrives mid-poll', async () => {
    process.env.CHECKOUT_REDIRECT_TIMEOUT_MS = '5000';
    getCheckoutSessionMock
      .mockResolvedValueOnce(baseSession()) // initial: not yet
      .mockResolvedValueOnce(baseSession()) // poll #1: still not
      .mockResolvedValueOnce(
        baseSession({
          status: 'awaiting_payment',
          ageVerifiedAt: new Date(),
          verificationId: 'v1',
        })
      ); // poll #2: arrived

    const res = await GET(makeReq(), ctx());
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(CLOVER_URL);
    expect(getCheckoutSessionMock.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('returns 408 with retry guidance when webhook never arrives within timeout', async () => {
    process.env.CHECKOUT_REDIRECT_TIMEOUT_MS = '500';
    getCheckoutSessionMock.mockResolvedValue(baseSession());
    const res = await GET(makeReq(), ctx());
    expect(res.status).toBe(408);
    const body = (await res.json()) as { error: string; retryAfterMs: number };
    expect(body.error).toMatch(/retry/i);
    expect(body.retryAfterMs).toBeGreaterThan(0);
    expect(res.headers.get('retry-after')).toBe('2');
  });

  it('returns 409 when session is expired', async () => {
    getCheckoutSessionMock.mockResolvedValueOnce(
      baseSession({ status: 'expired' })
    );
    const res = await GET(makeReq(), ctx());
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/expired/);
  });

  it('returns 409 when session is cancelled', async () => {
    getCheckoutSessionMock.mockResolvedValueOnce(
      baseSession({ status: 'cancelled' })
    );
    const res = await GET(makeReq(), ctx());
    expect(res.status).toBe(409);
  });

  it('returns 409 idempotently when session is already completed', async () => {
    getCheckoutSessionMock.mockResolvedValueOnce(
      baseSession({ status: 'completed', orderId: 'ord_1' })
    );
    const res = await GET(makeReq(), ctx());
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string; orderId: string };
    expect(body.orderId).toBe('ord_1');
  });

  it('returns 404 when CheckoutSession does not exist', async () => {
    getCheckoutSessionMock.mockResolvedValueOnce(null);
    const res = await GET(makeReq(), ctx());
    expect(res.status).toBe(404);
  });

  it('uses default 5s timeout when env var unset', async () => {
    // Sanity: default timeout path is reachable. We do not wait the full
    // 5s — we assert the route is wired without blowing up by completing
    // promptly when a verified session is found on the first poll.
    getCheckoutSessionMock
      .mockResolvedValueOnce(baseSession())
      .mockResolvedValueOnce(
        baseSession({
          status: 'awaiting_payment',
          ageVerifiedAt: new Date(),
          verificationId: 'v1',
        })
      );
    const res = await GET(makeReq(), ctx());
    expect(res.status).toBe(302);
  });
});
