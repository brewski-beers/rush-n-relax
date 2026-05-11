import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CheckoutSession } from '@/types/checkout-session';

const {
  getCheckoutSessionMock,
  markAgeVerifiedMock,
  markCheckoutSessionCancelledMock,
} = vi.hoisted(() => ({
  getCheckoutSessionMock: vi.fn(),
  markAgeVerifiedMock: vi.fn(),
  markCheckoutSessionCancelledMock: vi.fn(),
}));

vi.mock('@/lib/repositories', () => ({
  getCheckoutSession: getCheckoutSessionMock,
  markAgeVerified: markAgeVerifiedMock,
  markCheckoutSessionCancelled: markCheckoutSessionCancelledMock,
}));

import {
  simulateAgeVerifyPass,
  simulateAgeVerifyDeny,
} from './simulate-actions';

const ORIGINAL_VERCEL_ENV = process.env.VERCEL_ENV;

function sessionWith(
  over: Partial<CheckoutSession> & { status: CheckoutSession['status'] }
): CheckoutSession {
  const now = new Date();
  return {
    id: 'sess_123',
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
    ageVerifiedAt: null,
    verificationId: null,
    ageCheckerSessionId: null,
    holds: [],
    cloverCheckoutSessionId: 'sess_123',
    cloverCheckoutUrl: 'https://example.com/c/abc',
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + 60_000),
    ...over,
  };
}

describe('simulate-actions (#411)', () => {
  beforeEach(() => {
    getCheckoutSessionMock.mockReset();
    markAgeVerifiedMock.mockReset();
    markCheckoutSessionCancelledMock.mockReset();
    getCheckoutSessionMock.mockResolvedValue(
      sessionWith({ status: 'awaiting_id' })
    );
    markAgeVerifiedMock.mockResolvedValue(undefined);
    markCheckoutSessionCancelledMock.mockResolvedValue(undefined);
    process.env.VERCEL_ENV = 'preview';
  });

  afterEach(() => {
    if (ORIGINAL_VERCEL_ENV === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = ORIGINAL_VERCEL_ENV;
    }
  });

  describe('simulateAgeVerifyPass', () => {
    it('given preview env and awaiting_id, when invoked, then marks the session age-verified', async () => {
      const result = await simulateAgeVerifyPass('sess_123');

      expect(result).toEqual({ ok: true });
      expect(markAgeVerifiedMock).toHaveBeenCalledTimes(1);
      const [sessionId, verificationId, verifiedAt] =
        markAgeVerifiedMock.mock.calls[0];
      expect(sessionId).toBe('sess_123');
      expect(verificationId).toBe('simulate-preview');
      expect(verifiedAt).toBeInstanceOf(Date);
    });

    it('given development env, when invoked, then marks the session age-verified', async () => {
      process.env.VERCEL_ENV = 'development';

      const result = await simulateAgeVerifyPass('sess_123');

      expect(result).toEqual({ ok: true });
      expect(markAgeVerifiedMock).toHaveBeenCalledTimes(1);
    });

    it('given undefined VERCEL_ENV (local dev), when invoked, then marks the session age-verified', async () => {
      delete process.env.VERCEL_ENV;

      const result = await simulateAgeVerifyPass('sess_123');

      expect(result).toEqual({ ok: true });
      expect(markAgeVerifiedMock).toHaveBeenCalledTimes(1);
    });

    it('given session already in awaiting_payment, when invoked, then is idempotent and does NOT call markAgeVerified', async () => {
      getCheckoutSessionMock.mockResolvedValueOnce(
        sessionWith({
          status: 'awaiting_payment',
          ageVerifiedAt: new Date(),
          verificationId: 'v1',
        })
      );

      const result = await simulateAgeVerifyPass('sess_123');

      expect(result).toEqual({ ok: true });
      expect(markAgeVerifiedMock).not.toHaveBeenCalled();
    });

    it('given session is completed, when invoked, then is idempotent and does NOT call markAgeVerified', async () => {
      getCheckoutSessionMock.mockResolvedValueOnce(
        sessionWith({ status: 'completed', orderId: 'ord_1' })
      );

      const result = await simulateAgeVerifyPass('sess_123');

      expect(result).toEqual({ ok: true });
      expect(markAgeVerifiedMock).not.toHaveBeenCalled();
    });

    it('given session does not exist, when invoked, then throws', async () => {
      getCheckoutSessionMock.mockResolvedValueOnce(null);

      await expect(simulateAgeVerifyPass('sess_123')).rejects.toThrow(
        /not found/i
      );
      expect(markAgeVerifiedMock).not.toHaveBeenCalled();
    });

    it('given production env, when invoked, then refuses and never touches the repo', async () => {
      process.env.VERCEL_ENV = 'production';

      await expect(simulateAgeVerifyPass('sess_123')).rejects.toThrow(
        /disabled in production/i
      );
      expect(getCheckoutSessionMock).not.toHaveBeenCalled();
      expect(markAgeVerifiedMock).not.toHaveBeenCalled();
    });
  });

  describe('simulateAgeVerifyDeny', () => {
    it('given preview env and awaiting_id, when invoked, then cancels the session', async () => {
      const result = await simulateAgeVerifyDeny('sess_456');

      expect(result).toEqual({ ok: true });
      expect(markCheckoutSessionCancelledMock).toHaveBeenCalledWith('sess_456');
    });

    it('given session already in awaiting_payment, when invoked, then still cancels (non-terminal)', async () => {
      getCheckoutSessionMock.mockResolvedValueOnce(
        sessionWith({
          status: 'awaiting_payment',
          ageVerifiedAt: new Date(),
          verificationId: 'v1',
        })
      );

      const result = await simulateAgeVerifyDeny('sess_456');

      expect(result).toEqual({ ok: true });
      expect(markCheckoutSessionCancelledMock).toHaveBeenCalledWith('sess_456');
    });

    it('given session already cancelled, when invoked, then is idempotent and does NOT call markCheckoutSessionCancelled', async () => {
      getCheckoutSessionMock.mockResolvedValueOnce(
        sessionWith({ status: 'cancelled' })
      );

      const result = await simulateAgeVerifyDeny('sess_456');

      expect(result).toEqual({ ok: true });
      expect(markCheckoutSessionCancelledMock).not.toHaveBeenCalled();
    });

    it('given session is completed, when invoked, then is idempotent and does NOT call markCheckoutSessionCancelled', async () => {
      getCheckoutSessionMock.mockResolvedValueOnce(
        sessionWith({ status: 'completed', orderId: 'ord_1' })
      );

      const result = await simulateAgeVerifyDeny('sess_456');

      expect(result).toEqual({ ok: true });
      expect(markCheckoutSessionCancelledMock).not.toHaveBeenCalled();
    });

    it('given undefined VERCEL_ENV (local dev), when invoked, then cancels the session', async () => {
      delete process.env.VERCEL_ENV;

      const result = await simulateAgeVerifyDeny('sess_456');

      expect(result).toEqual({ ok: true });
      expect(markCheckoutSessionCancelledMock).toHaveBeenCalledWith('sess_456');
    });

    it('given production env, when invoked, then refuses and never touches the repo', async () => {
      process.env.VERCEL_ENV = 'production';

      await expect(simulateAgeVerifyDeny('sess_456')).rejects.toThrow(
        /disabled in production/i
      );
      expect(markCheckoutSessionCancelledMock).not.toHaveBeenCalled();
    });
  });
});
