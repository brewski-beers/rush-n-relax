import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { markAgeVerifiedMock, markCheckoutSessionCancelledMock } = vi.hoisted(
  () => ({
    markAgeVerifiedMock: vi.fn(),
    markCheckoutSessionCancelledMock: vi.fn(),
  })
);

vi.mock('@/lib/repositories', () => ({
  markAgeVerified: markAgeVerifiedMock,
  markCheckoutSessionCancelled: markCheckoutSessionCancelledMock,
}));

import {
  simulateAgeVerifyPass,
  simulateAgeVerifyDeny,
} from './simulate-actions';

const ORIGINAL_VERCEL_ENV = process.env.VERCEL_ENV;

describe('simulate-actions (#411)', () => {
  beforeEach(() => {
    markAgeVerifiedMock.mockReset();
    markCheckoutSessionCancelledMock.mockReset();
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
    it('given preview env, when invoked, then marks the session age-verified', async () => {
      const result = await simulateAgeVerifyPass('sess_123');

      expect(result).toEqual({ ok: true });
      expect(markAgeVerifiedMock).toHaveBeenCalledTimes(1);
      const [sessionId, verificationId, verifiedAt] =
        markAgeVerifiedMock.mock.calls[0];
      expect(sessionId).toBe('sess_123');
      expect(verificationId).toBe('simulate-preview');
      expect(verifiedAt).toBeInstanceOf(Date);
    });

    it('given production env, when invoked, then refuses and never touches the repo', async () => {
      process.env.VERCEL_ENV = 'production';

      await expect(simulateAgeVerifyPass('sess_123')).rejects.toThrow(
        /preview env/i
      );
      expect(markAgeVerifiedMock).not.toHaveBeenCalled();
    });

    it('given undefined VERCEL_ENV, when invoked, then refuses', async () => {
      delete process.env.VERCEL_ENV;

      await expect(simulateAgeVerifyPass('sess_123')).rejects.toThrow(
        /preview env/i
      );
      expect(markAgeVerifiedMock).not.toHaveBeenCalled();
    });
  });

  describe('simulateAgeVerifyDeny', () => {
    it('given preview env, when invoked, then cancels the session', async () => {
      const result = await simulateAgeVerifyDeny('sess_456');

      expect(result).toEqual({ ok: true });
      expect(markCheckoutSessionCancelledMock).toHaveBeenCalledWith('sess_456');
    });

    it('given production env, when invoked, then refuses and never touches the repo', async () => {
      process.env.VERCEL_ENV = 'production';

      await expect(simulateAgeVerifyDeny('sess_456')).rejects.toThrow(
        /preview env/i
      );
      expect(markCheckoutSessionCancelledMock).not.toHaveBeenCalled();
    });
  });
});
