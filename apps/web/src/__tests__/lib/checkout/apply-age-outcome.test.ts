import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CheckoutSession } from '@/types/checkout-session';

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

import { applyAgeVerificationOutcome } from '@/lib/checkout/apply-age-outcome';

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

describe('applyAgeVerificationOutcome', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCheckoutSessionMock.mockResolvedValue(makeSession());
    markAgeVerifiedMock.mockResolvedValue(
      makeSession({ status: 'awaiting_payment' })
    );
    markCheckoutSessionCancelledMock.mockResolvedValue(
      makeSession({ status: 'cancelled' })
    );
    releaseStockMock.mockResolvedValue(undefined);
  });
  afterEach(() => vi.clearAllMocks());

  it('resolves the session from lookup metadata.order when no sessionId is supplied', async () => {
    verifyVerificationIdMock.mockResolvedValue({
      valid: true,
      status: 'pass',
      verifiedAt: new Date('2026-05-02T00:00:00Z'),
      metadata: { order: 'sess-1' },
    });
    markAgeVerifiedMock.mockResolvedValue(
      makeSession({ status: 'awaiting_payment' })
    );

    const out = await applyAgeVerificationOutcome({
      verificationUuid: 'v1',
      actor: 'webhook:agechecker',
    });

    expect(out).toEqual({ kind: 'verified', sessionId: 'sess-1' });
    expect(getCheckoutSessionMock).toHaveBeenCalledWith('sess-1');
  });

  it('prefers the caller-supplied sessionId over lookup metadata', async () => {
    verifyVerificationIdMock.mockResolvedValue({
      valid: true,
      status: 'pass',
      metadata: { order: 'WRONG' },
    });
    markAgeVerifiedMock.mockResolvedValue(
      makeSession({ status: 'awaiting_payment' })
    );

    const out = await applyAgeVerificationOutcome({
      verificationUuid: 'v1',
      sessionId: 'sess-1',
      actor: 'confirm-age',
    });

    expect(out).toEqual({ kind: 'verified', sessionId: 'sess-1' });
    expect(getCheckoutSessionMock).toHaveBeenCalledWith('sess-1');
  });

  it('returns lookup_failed when the status is terminal-ish but no session can be resolved', async () => {
    // valid=false + status `deny` (terminal) but no metadata.order and no
    // caller sessionId → cannot act → lookup_failed.
    verifyVerificationIdMock.mockResolvedValue({
      valid: false,
      status: 'deny',
    });

    const out = await applyAgeVerificationOutcome({
      verificationUuid: 'orphan',
      actor: 'webhook:agechecker',
    });

    expect(out).toEqual({ kind: 'lookup_failed' });
    expect(getCheckoutSessionMock).not.toHaveBeenCalled();
  });

  it('returns pending (sessionId null) for a step-up status with no resolvable session', async () => {
    verifyVerificationIdMock.mockResolvedValue({
      valid: false,
      status: 'pending',
    });

    const out = await applyAgeVerificationOutcome({
      verificationUuid: 'v1',
      actor: 'webhook:agechecker',
    });

    expect(out).toEqual({ kind: 'pending', sessionId: null });
    expect(getCheckoutSessionMock).not.toHaveBeenCalled();
  });

  it('returns session_terminal for a completed session', async () => {
    verifyVerificationIdMock.mockResolvedValue({ valid: true, status: 'pass' });
    getCheckoutSessionMock.mockResolvedValue(
      makeSession({ status: 'completed', orderId: 'ord-1' })
    );

    const out = await applyAgeVerificationOutcome({
      verificationUuid: 'v1',
      sessionId: 'sess-1',
      actor: 'confirm-age',
    });

    expect(out).toEqual({
      kind: 'session_terminal',
      sessionId: 'sess-1',
      status: 'completed',
    });
    expect(markAgeVerifiedMock).not.toHaveBeenCalled();
  });

  it('returns session_terminal for an expired session', async () => {
    verifyVerificationIdMock.mockResolvedValue({ valid: true, status: 'pass' });
    getCheckoutSessionMock.mockResolvedValue(
      makeSession({ status: 'expired' })
    );

    const out = await applyAgeVerificationOutcome({
      verificationUuid: 'v1',
      sessionId: 'sess-1',
      actor: 'confirm-age',
    });

    expect(out).toMatchObject({ kind: 'session_terminal', status: 'expired' });
  });

  it('returns already_verified when the session is past awaiting_id', async () => {
    verifyVerificationIdMock.mockResolvedValue({ valid: true, status: 'pass' });
    getCheckoutSessionMock.mockResolvedValue(
      makeSession({ status: 'awaiting_payment', ageVerifiedAt: new Date() })
    );

    const out = await applyAgeVerificationOutcome({
      verificationUuid: 'v1',
      sessionId: 'sess-1',
      actor: 'confirm-age',
    });

    expect(out).toEqual({ kind: 'already_verified', sessionId: 'sess-1' });
    expect(markAgeVerifiedMock).not.toHaveBeenCalled();
  });

  it('returns already_cancelled when a denial lands on an already-cancelled session', async () => {
    verifyVerificationIdMock.mockResolvedValue({
      valid: false,
      status: 'deny',
    });
    getCheckoutSessionMock.mockResolvedValue(
      makeSession({ status: 'cancelled' })
    );

    const out = await applyAgeVerificationOutcome({
      verificationUuid: 'v1',
      sessionId: 'sess-1',
      actor: 'confirm-age',
    });

    expect(out).toEqual({ kind: 'already_cancelled', sessionId: 'sess-1' });
    expect(markCheckoutSessionCancelledMock).not.toHaveBeenCalled();
    expect(releaseStockMock).not.toHaveBeenCalled();
  });

  it('denial path: cancels then releases holds; releaseStock failure is swallowed', async () => {
    verifyVerificationIdMock.mockResolvedValue({
      valid: false,
      status: 'deny',
    });
    markCheckoutSessionCancelledMock.mockResolvedValue(
      makeSession({ status: 'cancelled' })
    );
    releaseStockMock.mockRejectedValue(new Error('firestore blip'));

    const out = await applyAgeVerificationOutcome({
      verificationUuid: 'v1',
      sessionId: 'sess-1',
      actor: 'confirm-age',
    });

    expect(out).toEqual({ kind: 'denied', sessionId: 'sess-1' });
    expect(markCheckoutSessionCancelledMock).toHaveBeenCalledWith('sess-1');
    expect(releaseStockMock).toHaveBeenCalledTimes(1);
  });

  it('underage normalizes to a denial', async () => {
    verifyVerificationIdMock.mockResolvedValue({
      valid: false,
      status: 'underage',
    });
    markCheckoutSessionCancelledMock.mockResolvedValue(
      makeSession({ status: 'cancelled' })
    );

    const out = await applyAgeVerificationOutcome({
      verificationUuid: 'v1',
      sessionId: 'sess-1',
      actor: 'confirm-age',
    });

    expect(out).toEqual({ kind: 'denied', sessionId: 'sess-1' });
    expect(releaseStockMock).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ reason: 'agechecker:underage' })
    );
  });

  it('verified path: passes the lookup verifiedAt through to markAgeVerified', async () => {
    verifyVerificationIdMock.mockResolvedValue({
      valid: true,
      status: 'pass',
      verifiedAt: new Date('2026-05-03T09:00:00Z'),
    });
    markAgeVerifiedMock.mockResolvedValue(
      makeSession({ status: 'awaiting_payment' })
    );

    await applyAgeVerificationOutcome({
      verificationUuid: 'v1',
      sessionId: 'sess-1',
      actor: 'confirm-age',
    });

    expect(markAgeVerifiedMock).toHaveBeenCalledWith(
      'sess-1',
      'v1',
      new Date('2026-05-03T09:00:00Z')
    );
  });

  it('verified path: treats InvalidCheckoutSessionTransitionError as already_verified', async () => {
    verifyVerificationIdMock.mockResolvedValue({ valid: true, status: 'pass' });
    markAgeVerifiedMock.mockRejectedValue(
      new InvalidCheckoutSessionTransitionErrorClass(
        'awaiting_payment',
        'awaiting_payment'
      )
    );

    const out = await applyAgeVerificationOutcome({
      verificationUuid: 'v1',
      sessionId: 'sess-1',
      actor: 'confirm-age',
    });

    expect(out).toEqual({ kind: 'already_verified', sessionId: 'sess-1' });
  });

  it('returns session_not_found when the resolved session does not exist', async () => {
    verifyVerificationIdMock.mockResolvedValue({ valid: true, status: 'pass' });
    getCheckoutSessionMock.mockResolvedValue(null);

    const out = await applyAgeVerificationOutcome({
      verificationUuid: 'v1',
      sessionId: 'gone',
      actor: 'confirm-age',
    });

    expect(out).toEqual({ kind: 'session_not_found', sessionId: 'gone' });
  });
});
