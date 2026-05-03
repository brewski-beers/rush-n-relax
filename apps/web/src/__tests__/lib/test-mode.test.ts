import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isLivePaymentsEnabled } from '@/lib/test-mode';

describe('test-mode kill switch', () => {
  const original = process.env.CLOVER_LIVE_PAYMENTS_ENABLED;

  beforeEach(() => {
    delete process.env.CLOVER_LIVE_PAYMENTS_ENABLED;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.CLOVER_LIVE_PAYMENTS_ENABLED;
    else process.env.CLOVER_LIVE_PAYMENTS_ENABLED = original;
  });

  it('defaults to false when the env var is unset (kill switch closed)', () => {
    expect(isLivePaymentsEnabled()).toBe(false);
  });

  it('returns true ONLY for the exact string "true"', () => {
    process.env.CLOVER_LIVE_PAYMENTS_ENABLED = 'true';
    expect(isLivePaymentsEnabled()).toBe(true);
  });

  it.each(['1', 'yes', 'TRUE', 'True', 'on', '', 'false'])(
    'returns false for ambiguous value %p',
    value => {
      process.env.CLOVER_LIVE_PAYMENTS_ENABLED = value;
      expect(isLivePaymentsEnabled()).toBe(false);
    }
  );
});
