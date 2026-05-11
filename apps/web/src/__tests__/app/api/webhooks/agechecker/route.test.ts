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
}));

vi.mock('@/lib/repositories', () => ({
  getCheckoutSession: getCheckoutSessionMock,
  markAgeVerified: markAgeVerifiedMock,
  markCheckoutSessionCancelled: markCheckoutSessionCancelledMock,
  releaseStock: releaseStockMock,
  InvalidCheckoutSessionTransitionError:
    InvalidCheckoutSessionTransitionErrorClass,
}));

import { POST } from '@/app/api/webhooks/agechecker/route';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, signature: string | null = 'sig'): Request {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (signature !== null) headers['x-agechecker-signature'] = signature;
  return new Request('http://localhost/api/webhooks/agechecker', {
    method: 'POST',
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

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/webhooks/agechecker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyAgeCheckerSignatureMock.mockReturnValue(true);
    isAgeCheckerTestModeMock.mockReturnValue(false);
    verifyVerificationIdMock.mockResolvedValue({
      valid: true,
      status: 'pass',
      verifiedAt: new Date('2026-05-02T12:00:00Z'),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('given an invalid signature', () => {
    it('returns 401 and writes nothing', async () => {
      verifyAgeCheckerSignatureMock.mockReturnValue(false);

      const res = await POST(
        makeRequest({ verificationId: 'v1', status: 'pass', order: 'sess-1' })
      );

      expect(res.status).toBe(401);
      expect(getCheckoutSessionMock).not.toHaveBeenCalled();
      expect(markAgeVerifiedMock).not.toHaveBeenCalled();
      expect(releaseStockMock).not.toHaveBeenCalled();
    });
  });

  describe('given a malformed JSON body', () => {
    it('returns 400', async () => {
      const res = await POST(makeRequest('not json{'));
      expect(res.status).toBe(400);
    });
  });

  describe('given status=pass with a valid verificationId and an awaiting_id session', () => {
    it('marks the session age-verified and returns 200 handled=true', async () => {
      getCheckoutSessionMock.mockResolvedValue(makeSession());
      markAgeVerifiedMock.mockResolvedValue(
        makeSession({ status: 'awaiting_payment' })
      );

      const res = await POST(
        makeRequest({ verificationId: 'v1', status: 'pass', order: 'sess-1' })
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { handled: boolean };
      expect(body.handled).toBe(true);
      expect(markAgeVerifiedMock).toHaveBeenCalledWith(
        'sess-1',
        'v1',
        expect.any(Date)
      );
      expect(releaseStockMock).not.toHaveBeenCalled();
    });
  });

  describe('given status=pass but the API lookup says the verificationId is not a pass', () => {
    it('returns 401 and does not mark the session', async () => {
      verifyVerificationIdMock.mockResolvedValue({
        valid: false,
        status: 'pending',
      });

      const res = await POST(
        makeRequest({
          verificationId: 'forged',
          status: 'pass',
          order: 'sess-1',
        })
      );

      expect(res.status).toBe(401);
      expect(markAgeVerifiedMock).not.toHaveBeenCalled();
    });
  });

  describe('given status=deny and a session with holds', () => {
    it('cancels the session and releases the holds', async () => {
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

      const res = await POST(
        makeRequest({ verificationId: 'v1', status: 'deny', order: 'sess-1' })
      );

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

  describe('given status=underage', () => {
    it('cancels the session and releases holds (same as deny)', async () => {
      getCheckoutSessionMock.mockResolvedValue(makeSession());
      markCheckoutSessionCancelledMock.mockResolvedValue(
        makeSession({ status: 'cancelled' })
      );

      const res = await POST(
        makeRequest({
          verificationId: 'v1',
          status: 'underage',
          order: 'sess-1',
        })
      );

      expect(res.status).toBe(200);
      expect(markCheckoutSessionCancelledMock).toHaveBeenCalledWith('sess-1');
      expect(releaseStockMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('given status=pending or status=manual_review', () => {
    it('logs only and does not mutate state', async () => {
      const res = await POST(
        makeRequest({
          verificationId: 'v1',
          status: 'pending',
          order: 'sess-1',
        })
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { handled: boolean };
      expect(body.handled).toBe(false);
      expect(getCheckoutSessionMock).not.toHaveBeenCalled();
      expect(markAgeVerifiedMock).not.toHaveBeenCalled();
      expect(markCheckoutSessionCancelledMock).not.toHaveBeenCalled();
      expect(releaseStockMock).not.toHaveBeenCalled();

      const res2 = await POST(
        makeRequest({
          verificationId: 'v1',
          status: 'manual_review',
          order: 'sess-1',
        })
      );
      expect(res2.status).toBe(200);
      const body2 = (await res2.json()) as { handled: boolean };
      expect(body2.handled).toBe(false);
    });
  });

  describe('given a re-fired pass webhook for a session already past awaiting_id', () => {
    it('is idempotent — acks 200 without re-marking', async () => {
      getCheckoutSessionMock.mockResolvedValue(
        makeSession({ status: 'awaiting_payment', ageVerifiedAt: new Date() })
      );

      const res = await POST(
        makeRequest({ verificationId: 'v1', status: 'pass', order: 'sess-1' })
      );

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

      const res = await POST(
        makeRequest({ verificationId: 'v1', status: 'pass', order: 'sess-1' })
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { handled: boolean; reason?: string };
      expect(body.reason).toBe('already_processed');
    });
  });

  describe('given a re-fired deny webhook for a session already cancelled', () => {
    it('is idempotent — acks without re-releasing holds', async () => {
      getCheckoutSessionMock.mockResolvedValue(
        makeSession({ status: 'cancelled' })
      );

      const res = await POST(
        makeRequest({ verificationId: 'v1', status: 'deny', order: 'sess-1' })
      );

      expect(res.status).toBe(200);
      expect(markCheckoutSessionCancelledMock).not.toHaveBeenCalled();
      expect(releaseStockMock).not.toHaveBeenCalled();
    });
  });

  describe('given a terminal payload missing the sessionId (order field)', () => {
    it('acks 200 handled=false and does not look up any session', async () => {
      const res = await POST(
        makeRequest({ verificationId: 'v1', status: 'pass' })
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { handled: boolean };
      expect(body.handled).toBe(false);
      expect(getCheckoutSessionMock).not.toHaveBeenCalled();
    });
  });

  describe('given status=pass for a sessionId that does not exist', () => {
    it('returns 404', async () => {
      getCheckoutSessionMock.mockResolvedValue(null);

      const res = await POST(
        makeRequest({ verificationId: 'v1', status: 'pass', order: 'gone' })
      );

      expect(res.status).toBe(404);
      expect(markAgeVerifiedMock).not.toHaveBeenCalled();
    });
  });

  describe('given the AgeChecker payload reports pass but creates no Order', () => {
    it('does not invoke any order-creation repository', async () => {
      getCheckoutSessionMock.mockResolvedValue(makeSession());
      markAgeVerifiedMock.mockResolvedValue(
        makeSession({ status: 'awaiting_payment' })
      );

      await POST(
        makeRequest({ verificationId: 'v1', status: 'pass', order: 'sess-1' })
      );

      // The route module imports nothing from order repos — sanity-check by
      // confirming only checkout-session helpers were called.
      expect(markAgeVerifiedMock).toHaveBeenCalledTimes(1);
      expect(markCheckoutSessionCancelledMock).not.toHaveBeenCalled();
    });
  });
});
