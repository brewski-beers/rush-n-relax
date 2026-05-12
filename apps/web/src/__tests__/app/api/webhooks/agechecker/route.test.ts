import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CheckoutSession } from '@/types/checkout-session';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  verifyAgeCheckerSignatureMock,
  verifyVerificationIdMock,
  isAgeCheckerTestModeMock,
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
    verifyAgeCheckerSignatureMock: vi.fn(),
    verifyVerificationIdMock: vi.fn(),
    isAgeCheckerTestModeMock: vi.fn(),
    getCheckoutSessionMock: vi.fn(),
    markAgeVerifiedMock: vi.fn(),
    markCheckoutSessionCancelledMock: vi.fn(),
    releaseStockMock: vi.fn(),
    InvalidCheckoutSessionTransitionErrorClass:
      InvalidCheckoutSessionTransitionError,
  };
});

vi.mock('@/lib/agechecker', () => ({
  verifyAgeCheckerSignature: verifyAgeCheckerSignatureMock,
  verifyVerificationId: verifyVerificationIdMock,
  isAgeCheckerTestMode: isAgeCheckerTestModeMock,
  // Real normalizeStatus — pure function, no need to mock it.
  normalizeStatus: (raw: unknown): string => {
    if (typeof raw !== 'string') return 'pending';
    const v = raw.toLowerCase();
    if (
      v === 'accepted' ||
      v === 'pass' ||
      v === 'passed' ||
      v === 'approved' ||
      v === 'verified'
    ) {
      return 'pass';
    }
    if (
      v === 'denied' ||
      v === 'deny' ||
      v === 'rejected' ||
      v === 'fail' ||
      v === 'failed'
    ) {
      return 'deny';
    }
    if (v === 'underage') return 'underage';
    if (v === 'manual_review' || v === 'manual' || v === 'review') {
      return 'manual_review';
    }
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

import { PUT, POST } from '@/app/api/webhooks/agechecker/route';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, signature: string | null = 'sig'): Request {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (signature !== null) headers['x-agechecker-signature'] = signature;
  return new Request('http://localhost/api/webhooks/agechecker', {
    method: 'PUT',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
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
    ageCheckerSessionId: null,
    holds: [
      {
        productId: 'prod-a',
        variantId: 'default',
        locationId: 'online',
        qty: 2,
      },
    ],
    cloverCheckoutSessionId: 'sess-1',
    createdAt: new Date('2026-05-01T00:00:00Z'),
    updatedAt: new Date('2026-05-01T00:00:00Z'),
    expiresAt: new Date('2026-05-01T01:00:00Z'),
    ...over,
  };
}

/** Default `verifyVerificationId` lookup result: accepted, order=sess-1. */
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

describe('PUT /api/webhooks/agechecker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyAgeCheckerSignatureMock.mockReturnValue(true);
    isAgeCheckerTestModeMock.mockReturnValue(false);
    verifyVerificationIdMock.mockResolvedValue(acceptedLookup());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('exports POST as a defensive alias of PUT', () => {
    expect(POST).toBe(PUT);
  });

  describe('given an invalid signature', () => {
    it('returns 401 and writes nothing', async () => {
      verifyAgeCheckerSignatureMock.mockReturnValue(false);

      const res = await PUT(makeRequest({ uuid: 'v1', status: 'accepted' }));

      expect(res.status).toBe(401);
      expect(verifyVerificationIdMock).not.toHaveBeenCalled();
      expect(getCheckoutSessionMock).not.toHaveBeenCalled();
      expect(markAgeVerifiedMock).not.toHaveBeenCalled();
      expect(releaseStockMock).not.toHaveBeenCalled();
    });
  });

  describe('given a malformed JSON body', () => {
    it('returns 400', async () => {
      const res = await PUT(makeRequest('not json{'));
      expect(res.status).toBe(400);
    });
  });

  describe('given a body with no uuid', () => {
    it('returns 400', async () => {
      const res = await PUT(makeRequest({ status: 'accepted' }));
      expect(res.status).toBe(400);
      expect(verifyVerificationIdMock).not.toHaveBeenCalled();
    });
  });

  describe('given the lookup cannot resolve metadata.order', () => {
    it('acks 200 handled=false and touches no session', async () => {
      verifyVerificationIdMock.mockResolvedValue({
        valid: false,
        status: 'pending',
      });
      const res = await PUT(
        makeRequest({ uuid: 'orphan', status: 'accepted' })
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { handled: boolean };
      expect(body.handled).toBe(false);
      expect(getCheckoutSessionMock).not.toHaveBeenCalled();
    });
  });

  describe('given the lookup says accepted and the session is awaiting_id', () => {
    it('marks the session age-verified using the lookup metadata.order + verifiedAt', async () => {
      getCheckoutSessionMock.mockResolvedValue(makeSession());
      markAgeVerifiedMock.mockResolvedValue(
        makeSession({ status: 'awaiting_payment' })
      );

      const res = await PUT(makeRequest({ uuid: 'v1', status: 'accepted' }));

      expect(res.status).toBe(200);
      const body = (await res.json()) as { handled: boolean };
      expect(body.handled).toBe(true);
      expect(getCheckoutSessionMock).toHaveBeenCalledWith('sess-1');
      expect(markAgeVerifiedMock).toHaveBeenCalledWith(
        'sess-1',
        'v1',
        new Date('2026-05-02T12:00:00Z')
      );
      expect(releaseStockMock).not.toHaveBeenCalled();
    });
  });

  describe('given the callback body says accepted but the lookup says denied', () => {
    it('treats it as a denial — cancels + releases stock (the lookup is authoritative)', async () => {
      verifyVerificationIdMock.mockResolvedValue(
        acceptedLookup({ valid: false, status: 'deny' })
      );
      getCheckoutSessionMock.mockResolvedValue(makeSession());
      markCheckoutSessionCancelledMock.mockResolvedValue(
        makeSession({ status: 'cancelled' })
      );

      const res = await PUT(
        makeRequest({ uuid: 'forged', status: 'accepted' })
      );

      expect(res.status).toBe(200);
      expect(markAgeVerifiedMock).not.toHaveBeenCalled();
      expect(markCheckoutSessionCancelledMock).toHaveBeenCalledWith('sess-1');
      expect(releaseStockMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('given the lookup says denied and a session with holds', () => {
    it('cancels the session and releases the holds', async () => {
      verifyVerificationIdMock.mockResolvedValue(
        acceptedLookup({ valid: false, status: 'deny' })
      );
      const session = makeSession({
        holds: [
          {
            productId: 'p1',
            variantId: 'default',
            locationId: 'online',
            qty: 3,
          },
          { productId: 'p2', variantId: 'v2', locationId: 'online', qty: 1 },
        ],
      });
      getCheckoutSessionMock.mockResolvedValue(session);
      markCheckoutSessionCancelledMock.mockResolvedValue(
        makeSession({ status: 'cancelled' })
      );

      const res = await PUT(makeRequest({ uuid: 'v1', status: 'denied' }));

      expect(res.status).toBe(200);
      const body = (await res.json()) as { handled: boolean };
      expect(body.handled).toBe(true);
      expect(markCheckoutSessionCancelledMock).toHaveBeenCalledWith('sess-1');
      expect(releaseStockMock).toHaveBeenCalledTimes(1);
      expect(releaseStockMock).toHaveBeenCalledWith(
        [
          {
            productId: 'p1',
            variantId: 'default',
            locationId: 'online',
            qty: 3,
          },
          { productId: 'p2', variantId: 'v2', locationId: 'online', qty: 1 },
        ],
        expect.objectContaining({ actor: 'webhook:agechecker' })
      );
    });
  });

  describe.each([
    'signature',
    'photo_id',
    'phone_validation',
    'sms_sent',
    'pending',
  ] as const)('given a non-terminal step-up status %s', step => {
    it('logs only and does not mutate state', async () => {
      verifyVerificationIdMock.mockResolvedValue({
        valid: false,
        status: 'pending',
        metadata: { order: 'sess-1' },
      });

      const res = await PUT(makeRequest({ uuid: 'v1', status: step }));

      expect(res.status).toBe(200);
      const body = (await res.json()) as { handled: boolean };
      expect(body.handled).toBe(false);
      expect(getCheckoutSessionMock).not.toHaveBeenCalled();
      expect(markAgeVerifiedMock).not.toHaveBeenCalled();
      expect(markCheckoutSessionCancelledMock).not.toHaveBeenCalled();
      expect(releaseStockMock).not.toHaveBeenCalled();
    });
  });

  describe('given a re-fired accepted callback for a session already past awaiting_id', () => {
    it('is idempotent — acks 200 without re-marking', async () => {
      getCheckoutSessionMock.mockResolvedValue(
        makeSession({ status: 'awaiting_payment', ageVerifiedAt: new Date() })
      );

      const res = await PUT(makeRequest({ uuid: 'v1', status: 'accepted' }));

      expect(res.status).toBe(200);
      const body = (await res.json()) as { handled: boolean; reason?: string };
      expect(body.handled).toBe(false);
      expect(body.reason).toBe('already_processed');
      expect(markAgeVerifiedMock).not.toHaveBeenCalled();
    });

    it('treats InvalidCheckoutSessionTransitionError as a duplicate', async () => {
      getCheckoutSessionMock.mockResolvedValue(makeSession());
      markAgeVerifiedMock.mockRejectedValue(
        new InvalidCheckoutSessionTransitionErrorClass(
          'awaiting_payment',
          'awaiting_payment'
        )
      );

      const res = await PUT(makeRequest({ uuid: 'v1', status: 'accepted' }));

      expect(res.status).toBe(200);
      const body = (await res.json()) as { handled: boolean; reason?: string };
      expect(body.reason).toBe('already_processed');
    });
  });

  describe('given a re-fired denied callback for a session already cancelled', () => {
    it('is idempotent — acks without re-releasing holds', async () => {
      verifyVerificationIdMock.mockResolvedValue(
        acceptedLookup({ valid: false, status: 'deny' })
      );
      getCheckoutSessionMock.mockResolvedValue(
        makeSession({ status: 'cancelled' })
      );

      const res = await PUT(makeRequest({ uuid: 'v1', status: 'denied' }));

      expect(res.status).toBe(200);
      expect(markCheckoutSessionCancelledMock).not.toHaveBeenCalled();
      expect(releaseStockMock).not.toHaveBeenCalled();
    });
  });

  describe('given the lookup resolves accepted for a sessionId that does not exist', () => {
    it('returns 404', async () => {
      verifyVerificationIdMock.mockResolvedValue(
        acceptedLookup({ metadata: { order: 'gone' } })
      );
      getCheckoutSessionMock.mockResolvedValue(null);

      const res = await PUT(makeRequest({ uuid: 'v1', status: 'accepted' }));

      expect(res.status).toBe(404);
      expect(markAgeVerifiedMock).not.toHaveBeenCalled();
    });
  });

  describe('given the AgeChecker callback reports accepted', () => {
    it('does not invoke any order-creation repository', async () => {
      getCheckoutSessionMock.mockResolvedValue(makeSession());
      markAgeVerifiedMock.mockResolvedValue(
        makeSession({ status: 'awaiting_payment' })
      );

      await PUT(makeRequest({ uuid: 'v1', status: 'accepted' }));

      expect(markAgeVerifiedMock).toHaveBeenCalledTimes(1);
      expect(markCheckoutSessionCancelledMock).not.toHaveBeenCalled();
    });
  });
});
