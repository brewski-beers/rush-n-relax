import { describe, it, expect } from 'vitest';
import { resolveVariantPricing } from '@/lib/storefront/resolveVariantPricing';
import type { ProductVariant } from '@/types/product';

const ONLINE = 'online';

const VARIANTS: { [variantId: string]: ProductVariant } = {
  eighth: {
    label: '3.5g',
    locations: { [ONLINE]: { qty: 5, price: 3000 } },
  },
  quarter: {
    label: '7g',
    locations: {
      [ONLINE]: { qty: 5, price: 5500, compareAtPrice: 6000 },
    },
  },
  // `half` has no online location entry — should be skipped
  half: { label: '14g', locations: {} },
};

describe('resolveVariantPricing', () => {
  it('returns only variants that have a location entry at the given location', () => {
    const result = resolveVariantPricing(VARIANTS, ONLINE);
    const ids = result.map(v => v.variantId);
    expect(ids).toContain('eighth');
    expect(ids).toContain('quarter');
    expect(ids).not.toContain('half');
  });

  it('passes through compareAtPrice for sale variants', () => {
    const result = resolveVariantPricing(VARIANTS, ONLINE);
    const quarter = result.find(v => v.variantId === 'quarter');
    expect(quarter?.price).toBe(5500);
    expect(quarter?.compareAtPrice).toBe(6000);
  });

  it('compareAtPrice is undefined when not a sale item', () => {
    const result = resolveVariantPricing(VARIANTS, ONLINE);
    const eighth = result.find(v => v.variantId === 'eighth');
    expect(eighth?.compareAtPrice).toBeUndefined();
  });

  it('marks variants with qty>0 as inStock', () => {
    const result = resolveVariantPricing(VARIANTS, ONLINE);
    expect(result.every(v => v.inStock)).toBe(true);
  });

  it('marks variants out of stock when qty<=reserved at this location', () => {
    const oos: { [variantId: string]: ProductVariant } = {
      eighth: {
        label: '3.5g',
        locations: { [ONLINE]: { qty: 0, price: 3000 } },
      },
      quarter: {
        label: '7g',
        locations: { [ONLINE]: { qty: 2, reserved: 2, price: 5500 } },
      },
    };
    const result = resolveVariantPricing(oos, ONLINE);
    expect(result.find(v => v.variantId === 'eighth')?.inStock).toBe(false);
    expect(result.find(v => v.variantId === 'quarter')?.inStock).toBe(false);
  });

  it('uses the variant map label', () => {
    const result = resolveVariantPricing(VARIANTS, ONLINE);
    const eighth = result.find(v => v.variantId === 'eighth');
    expect(eighth?.label).toBe('3.5g');
  });

  it('sorts results by price ascending', () => {
    const result = resolveVariantPricing(VARIANTS, ONLINE);
    const prices = result.map(v => v.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('returns [] when variants is undefined', () => {
    expect(resolveVariantPricing(undefined, ONLINE)).toEqual([]);
  });

  it('returns [] when no variant has a location entry for the queried locationId', () => {
    expect(resolveVariantPricing(VARIANTS, 'not-a-real-location')).toEqual([]);
  });
});
