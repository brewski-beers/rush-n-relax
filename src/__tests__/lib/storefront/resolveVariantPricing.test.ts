import { describe, it, expect } from 'vitest';
import { resolveVariantPricing } from '@/lib/storefront/resolveVariantPricing';
import type { ProductVariant } from '@/types/product';
import type { InventoryItem } from '@/types/inventory';

const FLOWER_VARIANTS: ProductVariant[] = [
  { variantId: 'eighth', label: '3.5g' },
  { variantId: 'quarter', label: '7g' },
  { variantId: 'half', label: '14g' },
];

const PRICING: InventoryItem['variantPricing'] = {
  eighth: { price: 3000 },
  quarter: { price: 5500, compareAtPrice: 6000 },
};

describe('resolveVariantPricing', () => {
  it('returns only variants that have a price entry', () => {
    const result = resolveVariantPricing(FLOWER_VARIANTS, PRICING);
    const ids = result.map(v => v.variantId);
    expect(ids).toContain('eighth');
    expect(ids).toContain('quarter');
    expect(ids).not.toContain('half'); // no pricing entry
  });

  it('passes through compareAtPrice for sale variants', () => {
    const result = resolveVariantPricing(FLOWER_VARIANTS, PRICING);
    const quarter = result.find(v => v.variantId === 'quarter');
    expect(quarter?.price).toBe(5500);
    expect(quarter?.compareAtPrice).toBe(6000);
  });

  it('compareAtPrice is undefined when not a sale item', () => {
    const result = resolveVariantPricing(FLOWER_VARIANTS, PRICING);
    const eighth = result.find(v => v.variantId === 'eighth');
    expect(eighth?.compareAtPrice).toBeUndefined();
  });

  it('inherits item-level inStock when variant-level flag absent', () => {
    const result = resolveVariantPricing(FLOWER_VARIANTS, PRICING, true);
    expect(result.every(v => v.inStock)).toBe(true);

    const resultOos = resolveVariantPricing(FLOWER_VARIANTS, PRICING, false);
    expect(resultOos.every(v => !v.inStock)).toBe(true);
  });

  it('respects variant-level inStock override', () => {
    const pricingWithOverride: InventoryItem['variantPricing'] = {
      eighth: { price: 3000, inStock: false },
      quarter: { price: 5500, inStock: true },
    };
    const result = resolveVariantPricing(
      FLOWER_VARIANTS,
      pricingWithOverride,
      true
    );
    expect(result.find(v => v.variantId === 'eighth')?.inStock).toBe(false);
    expect(result.find(v => v.variantId === 'quarter')?.inStock).toBe(true);
  });

  it('sorts results by price ascending', () => {
    const result = resolveVariantPricing(FLOWER_VARIANTS, PRICING);
    const prices = result.map(v => v.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('returns [] when variantPricing is undefined', () => {
    expect(resolveVariantPricing(FLOWER_VARIANTS, undefined)).toEqual([]);
  });

  it('returns [] when variantPricing is empty', () => {
    expect(resolveVariantPricing(FLOWER_VARIANTS, {})).toEqual([]);
  });

  it('returns [] when variants is undefined', () => {
    expect(resolveVariantPricing(undefined, PRICING)).toEqual([]);
  });

  it('returns [] when variants is empty', () => {
    expect(resolveVariantPricing([], PRICING)).toEqual([]);
  });
});
