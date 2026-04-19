import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Tests ──────────────────────────────────────────────────────────────────
// We re-import the module after resetting to get a fresh Map each test suite.
// Vitest module cache is shared within a suite, so we use vi.useFakeTimers()
// to control Date.now() and drive window expiry without actual sleeps.

describe('isRateLimited', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('given a new IP within a fresh window', () => {
    it('returns false on the first request', async () => {
      vi.setSystemTime(1_000_000);
      const { isRateLimited } = await import('@/lib/rate-limit');

      expect(isRateLimited('1.2.3.4')).toBe(false);
    });
  });

  describe('given an IP that has not yet exceeded the limit', () => {
    it('returns false for requests up to and including the limit', async () => {
      vi.setSystemTime(1_000_000);
      const { isRateLimited } = await import('@/lib/rate-limit');

      // MAX_REQUESTS = 5; first call counts as 1
      expect(isRateLimited('1.2.3.5')).toBe(false); // 1
      expect(isRateLimited('1.2.3.5')).toBe(false); // 2
      expect(isRateLimited('1.2.3.5')).toBe(false); // 3
      expect(isRateLimited('1.2.3.5')).toBe(false); // 4
      expect(isRateLimited('1.2.3.5')).toBe(false); // 5 (at limit, not yet over)
    });
  });

  describe('given an IP that has exceeded the limit', () => {
    it('returns true on the (MAX_REQUESTS + 1)th call', async () => {
      vi.setSystemTime(2_000_000);
      const { isRateLimited } = await import('@/lib/rate-limit');

      for (let i = 0; i < 5; i++) {
        isRateLimited('10.0.0.1');
      }

      expect(isRateLimited('10.0.0.1')).toBe(true);
    });
  });

  describe('given the rate-limit window has expired', () => {
    it('resets the counter and returns false again', async () => {
      vi.setSystemTime(3_000_000);
      const { isRateLimited } = await import('@/lib/rate-limit');

      // Exhaust the window
      for (let i = 0; i < 6; i++) {
        isRateLimited('10.0.0.2');
      }
      expect(isRateLimited('10.0.0.2')).toBe(true);

      // Advance past the 60-second window
      vi.setSystemTime(3_000_000 + 61_000);

      // Should be allowed again (new window)
      expect(isRateLimited('10.0.0.2')).toBe(false);
    });
  });
});
