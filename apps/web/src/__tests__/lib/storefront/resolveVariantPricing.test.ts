import { describe, it, expect } from 'vitest';
import { resolveVariantPricing } from '@/lib/storefront/resolveVariantPricing';
import type { ProductVariant, ProductVariantSpec } from '@/types/product';

const ONLINE = 'online';

const FLOWER_VARIANTS: ProductVariant[] = [
  { variantId: 'eighth', label: '3.5g' },
  { variantId: 'quarter', label: '7g' },
  { variantId: 'half', label: '14g' },
];

const SPECS: { [variantId: string]: ProductVariantSpec } = {
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
    const result = resolveVariantPricing(SPECS, ONLINE, FLOWER_VARIANTS);
    const ids = result.map(v => v.variantId);
    expect(ids).toContain('eighth');
    expect(ids).toContain('quarter');
    expect(ids).not.toContain('half');
  });

  it('passes through compareAtPrice for sale variants', () => {
    const result = resolveVariantPricing(SPECS, ONLINE, FLOWER_VARIANTS);
    const quarter = result.find(v => v.variantId === 'quarter');
    expect(quarter?.price).toBe(5500);
    expect(quarter?.compareAtPrice).toBe(6000);
  });

  it('compareAtPrice is undefined when not a sale item', () => {
    const result = resolveVariantPricing(SPECS, ONLINE, FLOWER_VARIANTS);
    const eighth = result.find(v => v.variantId === 'eighth');
    expect(eighth?.compareAtPrice).toBeUndefined();
  });

  it('marks variants with qty>0 as inStock', () => {
    const result = resolveVariantPricing(SPECS, ONLINE, FLOWER_VARIANTS);
    expect(result.every(v => v.inStock)).toBe(true);
  });

  it('marks variants out of stock when qty<=reserved at this location', () => {
    const oos: { [variantId: string]: ProductVariantSpec } = {
      eighth: {
        label: '3.5g',
        locations: { [ONLINE]: { qty: 0, price: 3000 } },
      },
      quarter: {
        label: '7g',
        locations: { [ONLINE]: { qty: 2, reserved: 2, price: 5500 } },
      },
    };
    const result = resolveVariantPricing(oos, ONLINE, FLOWER_VARIANTS);
    expect(result.find(v => v.variantId === 'eighth')?.inStock).toBe(false);
    expect(result.find(v => v.variantId === 'quarter')?.inStock).toBe(false);
  });

  it('falls back to spec.label when legacy variants list is missing', () => {
    const result = resolveVariantPricing(SPECS, ONLINE);
    const eighth = result.find(v => v.variantId === 'eighth');
    expect(eighth?.label).toBe('3.5g');
  });

  it('sorts results by price ascending', () => {
    const result = resolveVariantPricing(SPECS, ONLINE, FLOWER_VARIANTS);
    const prices = result.map(v => v.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('returns [] when variantSpecs is undefined', () => {
    expect(resolveVariantPricing(undefined, ONLINE, FLOWER_VARIANTS)).toEqual(
      []
    );
  });

  it('returns [] when no variant has a location entry for the queried locationId', () => {
    expect(resolveVariantPricing(SPECS, 'not-a-real-location')).toEqual([]);
  });
});
