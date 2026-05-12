import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CheckoutSession } from '@/types/checkout-session';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  verifyVerificationIdMock,
  getCheckoutSessionMock,
  markAgeVerifiedMock,
  markCheckoutSessionCancelledMock,
  releaseStockMock,
  InvalidCheckoutSessionTransitionErrorClass,
} = vi.hoisted(() => {
  class InvalidCheckoutSessionTransitionError extends Error {
    constructor(from: string | null, to: string) {
      super(`Invalid checkout session transition: ${from ?? 'null'} → ${to}`);
      this.name = 'InvalidCheckoutSessionTransitionError';
    }
  }
  return {
    verifyVerificationIdMock: vi.fn(),
    getCheckoutSessionMock: vi.fn(),
    markAgeVerifiedMock: vi.fn(),
    markCheckoutSessionCancelledMock: vi.fn(),
    releaseStockMock: vi.fn(),
    InvalidCheckoutSessionTransitionErrorClass:
      InvalidCheckoutSessionTransitionError,
  };
});

vi.mock('@/lib/agechecker', () => ({
  verifyVerificationId: verifyVerificationIdMock,
  // Real-ish normalizeStatus — pure, no need to mock the actual module.
  normalizeStatus: (raw: unknown): string => {
    if (typeof raw !== 'string') return 'pending';
    const v = raw.toLowerCase();
    if (['accepted', 'pass', 'passed', 'approved', 'verified'].includes(v))
      return 'pass';
    if (['denied', 'deny', 'rejected', 'fail', 'failed'].includes(v))
      return 'deny';
    if (v === 'underage') return 'underage';
    if (['manual_review', 'manual', 'review'].includes(v))
      return 'manual_review';
    return 'pending';
  },
}));

vi.mock('@/lib/repositories', () => ({
  getCheckoutSession: getCheckoutSessionMock,
  markAgeVerified: markAgeVerifiedMock,
  markCheckoutSessionCancelled: markCheckoutSessionCancelledMock,
  releaseStock: releaseStockMock,
  InvalidCheckoutSessionTransitionError:
    InvalidCheckoutSessionTransitionErrorClass,
}));

// The route imports getCheckoutSession from the concrete repository module
// as well — mock that path to the same fn.
vi.mock('@/lib/repositories/checkout-session.repository', () => ({
  getCheckoutSession: getCheckoutSessionMock,
}));

import { POST } from '@/app/api/checkout/[sessionId]/confirm-age/route';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, sessionId = 'sess-1'): Request {
  return new Request(`http://localhost/api/checkout/${sessionId}/confirm-age`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function ctx(sessionId = 'sess-1') {
  return { params: Promise.resolve({ sessionId }) };
}

function makeSession(over: Partial<CheckoutSession> = {}): CheckoutSession {
  return {
    id: 'sess-1',
    items: [],
    subtotal: 1000,
    tax: 0,
    total: 1000,
    locationId: 'online',
    deliveryAddress: {
      name: 'A',
      line1: '1 St',
      city: 'X',
      state: 'TN',
      zip: '37000',
    },
    status: 'awaiting_id',
    ageVerifiedAt: null,
    verificationId: null,
    ageCheckerSessionId: 'ac-uuid',
    holds: [
      { productId: 'p1', variantId: 'default', locationId: 'online', qty: 2 },
    ],
    cloverCheckoutSessionId: 'sess-1',
    createdAt: new Date('2026-05-01T00:00:00Z'),
    updatedAt: new Date('2026-05-01T00:00:00Z'),
    expiresAt: new Date('2026-05-01T01:00:00Z'),
    ...over,
  };
}

function acceptedLookup(over: Record<string, unknown> = {}) {
  return {
    valid: true,
    status: 'pass' as const,
    verifiedAt: new Date('2026-05-02T12:00:00Z'),
    metadata: { order: 'sess-1' },
    ...over,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/checkout/[sessionId]/confirm-age', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyVerificationIdMock.mockResolvedValue(acceptedLookup());
    getCheckoutSessionMock.mockResolvedValue(makeSession());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('given a missing/invalid body', () => {
    it('400 when body is not JSON', async () => {
      const res = await POST(makeRequest('not json{') as never, ctx());
      expect(res.status).toBe(400);
    });

    it('400 when verificationUuid is absent', async () => {
      const res = await POST(makeRequest({}) as never, ctx());
      expect(res.status).toBe(400);
      expect(verifyVerificationIdMock).not.toHaveBeenCalled();
    });
  });

  describe('given the session does not exist', () => {
    it('404', async () => {
      getCheckoutSessionMock.mockResolvedValue(null);
      const res = await POST(
        makeRequest({ verificationUuid: 'v1' }) as never,
        ctx()
      );
      expect(res.status).toBe(404);
      expect(verifyVerificationIdMock).not.toHaveBeenCalled();
    });
  });

  describe.each(['completed', 'expired', 'cancelled'] as const)(
    'given the session is %s',
    status => {
      it('409 without an AgeChecker lookup', async () => {
        getCheckoutSessionMock.mockResolvedValue(makeSession({ status }));
        const res = await POST(
          makeRequest({ verificationUuid: 'v1' }) as never,
          ctx()
        );
        expect(res.status).toBe(409);
        expect(verifyVerificationIdMock).not.toHaveBeenCalled();
      });
    }
  );

  describe('given the session is already awaiting_payment', () => {
    it('200 idempotent ack without a lookup', async () => {
      getCheckoutSessionMock.mockResolvedValue(
        makeSession({ status: 'awaiting_payment' })
      );
      const res = await POST(
        makeRequest({ verificationUuid: 'v1' }) as never,
        ctx()
      );
      expect(res.status).toBe(200);
      expect((await res.json()) as unknown).toEqual({
        ok: true,
        alreadyVerified: true,
      });
      expect(verifyVerificationIdMock).not.toHaveBeenCalled();
    });

    it('200 idempotent ack when ageVerifiedAt is already set', async () => {
      getCheckoutSessionMock.mockResolvedValue(
        makeSession({ ageVerifiedAt: new Date() })
      );
      const res = await POST(
        makeRequest({ verificationUuid: 'v1' }) as never,
        ctx()
      );
      expect(res.status).toBe(200);
      expect((await res.json()) as unknown).toEqual({
        ok: true,
        alreadyVerified: true,
      });
    });
  });

  describe('given the lookup says accepted and the session is awaiting_id', () => {
    it('marks the session age-verified with the verification uuid + verifiedAt', async () => {
      markAgeVerifiedMock.mockResolvedValue(
        makeSession({ status: 'awaiting_payment' })
      );

      const res = await POST(
        makeRequest({ verificationUuid: 'verif-1' }) as never,
        ctx()
      );

      expect(res.status).toBe(200);
      expect((await res.json()) as unknown).toEqual({ ok: true });
      expect(verifyVerificationIdMock).toHaveBeenCalledWith('verif-1');
      expect(markAgeVerifiedMock).toHaveBeenCalledWith(
        'sess-1',
        'verif-1',
        new Date('2026-05-02T12:00:00Z')
      );
      expect(releaseStockMock).not.toHaveBeenCalled();
    });

    it('falls back to now() when the lookup omits verifiedAt', async () => {
      verifyVerificationIdMock.mockResolvedValue(
        acceptedLookup({ verifiedAt: undefined })
      );
      markAgeVerifiedMock.mockResolvedValue(
        makeSession({ status: 'awaiting_payment' })
      );

      await POST(makeRequest({ verificationUuid: 'verif-1' }) as never, ctx());

      expect(markAgeVerifiedMock).toHaveBeenCalledTimes(1);
      const [, , verifiedAt] = markAgeVerifiedMock.mock.calls[0] as [
        string,
        string,
        Date,
      ];
      expect(verifiedAt).toBeInstanceOf(Date);
    });
  });

  describe('given markAgeVerified loses the race (InvalidCheckoutSessionTransitionError)', () => {
    it('200 alreadyVerified', async () => {
      markAgeVerifiedMock.mockRejectedValue(
        new InvalidCheckoutSessionTransitionErrorClass(
          'awaiting_payment',
          'awaiting_payment'
        )
      );
      const res = await POST(
        makeRequest({ verificationUuid: 'v1' }) as never,
        ctx()
      );
      expect(res.status).toBe(200);
      expect((await res.json()) as unknown).toEqual({
        ok: true,
        alreadyVerified: true,
      });
    });
  });

  describe('given the lookup says denied', () => {
    it('cancels the session and releases the holds', async () => {
      verifyVerificationIdMock.mockResolvedValue(
        acceptedLookup({ valid: false, status: 'deny' })
      );
      markCheckoutSessionCancelledMock.mockResolvedValue(
        makeSession({ status: 'cancelled' })
      );

      const res = await POST(
        makeRequest({ verificationUuid: 'v1' }) as never,
        ctx()
      );

      expect(res.status).toBe(200);
      expect((await res.json()) as unknown).toEqual({ ok: true, denied: true });
      expect(markCheckoutSessionCancelledMock).toHaveBeenCalledWith('sess-1');
      expect(releaseStockMock).toHaveBeenCalledTimes(1);
      expect(releaseStockMock).toHaveBeenCalledWith(
        [
          {
            productId: 'p1',
            variantId: 'default',
            locationId: 'online',
            qty: 2,
          },
        ],
        expect.objectContaining({
          actor: 'confirm-age',
          reason: 'agechecker:deny',
        })
      );
    });
  });

  describe.each(['pending', 'signature', 'photo_id', 'sms_sent'] as const)(
    'given a non-terminal step-up status %s',
    () => {
      it('200 pending with no state change', async () => {
        verifyVerificationIdMock.mockResolvedValue({
          valid: false,
          status: 'pending',
          metadata: { order: 'sess-1' },
        });

        const res = await POST(
          makeRequest({ verificationUuid: 'v1' }) as never,
          ctx()
        );

        expect(res.status).toBe(200);
        expect((await res.json()) as unknown).toEqual({
          ok: true,
          pending: true,
        });
        expect(markAgeVerifiedMock).not.toHaveBeenCalled();
        expect(markCheckoutSessionCancelledMock).not.toHaveBeenCalled();
        expect(releaseStockMock).not.toHaveBeenCalled();
      });
    }
  );

  describe('given the underlying session vanishes between guard and outcome', () => {
    it('404 (session_not_found from the shared helper)', async () => {
      // First read (guard) returns a live session; the helper's read inside
      // applyAgeVerificationOutcome returns null (deleted concurrently).
      getCheckoutSessionMock
        .mockResolvedValueOnce(makeSession())
        .mockResolvedValueOnce(null);
      const res = await POST(
        makeRequest({ verificationUuid: 'v1' }) as never,
        ctx()
      );
      expect(res.status).toBe(404);
    });
  });
});
