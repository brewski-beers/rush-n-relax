import { describe, it, expect } from 'vitest';
import { computeMarkupPercent, formatCents } from '../pricing';

describe('computeMarkupPercent', () => {
  it('returns correct markup when cost and price provided', () => {
    // cost $10, price $15 => 50% markup
    expect(computeMarkupPercent(1000, 1500)).toBeCloseTo(50);
  });

  it('returns undefined when cost is 0', () => {
    expect(computeMarkupPercent(0, 1500)).toBeUndefined();
  });

  it('returns undefined when cost is undefined', () => {
    expect(computeMarkupPercent(undefined, 1500)).toBeUndefined();
  });

  it('returns negative markup when price < cost', () => {
    // cost $20, price $15 => -25% markup
    expect(computeMarkupPercent(2000, 1500)).toBeCloseTo(-25);
  });

  it('returns 0 when price equals cost', () => {
    expect(computeMarkupPercent(1000, 1000)).toBeCloseTo(0);
  });
});

describe('formatCents', () => {
  it('formats 999 cents as $9.99', () => {
    expect(formatCents(999)).toBe('$9.99');
  });

  it('formats 100 cents as $1.00', () => {
    expect(formatCents(100)).toBe('$1.00');
  });

  it('formats 0 cents as $0.00', () => {
    expect(formatCents(0)).toBe('$0.00');
  });

  it('formats 2999 cents as $29.99', () => {
    expect(formatCents(2999)).toBe('$29.99');
  });
});
