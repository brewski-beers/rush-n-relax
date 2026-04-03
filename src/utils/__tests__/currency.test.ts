import { describe, it, expect } from 'vitest';
import { formatCents } from '../currency';

describe('formatCents', () => {
  it('formats whole dollar amounts', () => {
    expect(formatCents(1000)).toBe('$10.00');
  });

  it('formats cents with decimals', () => {
    expect(formatCents(999)).toBe('$9.99');
  });

  it('formats zero', () => {
    expect(formatCents(0)).toBe('$0.00');
  });

  it('formats large amounts', () => {
    expect(formatCents(100000)).toBe('$1,000.00');
  });

  it('formats single cent', () => {
    expect(formatCents(1)).toBe('$0.01');
  });
});
