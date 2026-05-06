/**
 * resolveVariantPricing — pure pricing resolution for the storefront.
 *
 * Builds the display-ready list of purchasable variants by reading the
 * unified `Product.variants` map for the given location. No Firestore
 * calls — safe in both Server Components and client-side code.
 */
import type { ProductVariant } from '@/types/product';

export interface DisplayVariant {
  variantId: string;
  label: string;
  /** Price in cents */
  price: number;
  /** Compare-at (original) price in cents — present when item is on sale */
  compareAtPrice?: number;
  inStock: boolean;
}

/**
 * Build the list of purchasable variants for the storefront variant selector.
 *
 * Rules:
 * - Only variants that have an entry at the given location are included.
 * - `inStock` is derived from `qty - (reserved ?? 0) > 0` at that location.
 * - The variant label comes from `variants[variantId].label`, falling back
 *   to the variantId when the label is missing.
 * - Results are sorted by price ascending.
 * - Returns `[]` when `variants` is undefined/empty.
 *
 * #397 step 2 of variant-model unification: signature reads the unified
 * `variants` map directly. The legacy `legacyVariants?` parameter (added
 * in PR #383) was dropped — labels come from the map entries themselves.
 */
export function resolveVariantPricing(
  variants: { [variantId: string]: ProductVariant } | undefined,
  locationId: string
): DisplayVariant[] {
  if (!variants) return [];

  const results: DisplayVariant[] = [];

  for (const [variantId, spec] of Object.entries(variants)) {
    const loc = spec?.locations?.[locationId];
    if (!loc || typeof loc.price !== 'number') continue;

    const available = (loc.qty ?? 0) - (loc.reserved ?? 0);
    const inStock = available > 0;

    results.push({
      variantId,
      label: spec.label ?? variantId,
      price: loc.price,
      compareAtPrice: loc.compareAtPrice,
      inStock,
    });
  }

  return results.sort((a, b) => a.price - b.price);
}
