/**
 * resolveVariantPricing — pure pricing resolution for the storefront.
 *
 * Builds the display-ready list of purchasable variants by reading
 * `Product.variantSpecs` for the given location. No Firestore calls — safe
 * in both Server Components and client-side code.
 */
import type { LegacyProductVariant, ProductVariantSpec } from '@/types/product';

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
 * - The variant label comes from `variantSpecs[variantId].label`, falling
 *   back to the legacy `variants[].label` when the new map omits a label.
 * - Results are sorted by price ascending.
 * - Returns `[]` when `variantSpecs` is undefined/empty.
 */
export function resolveVariantPricing(
  variantSpecs: { [variantId: string]: ProductVariantSpec } | undefined,
  locationId: string,
  legacyVariants?: LegacyProductVariant[]
): DisplayVariant[] {
  if (!variantSpecs) return [];

  const labelByVariantId = new Map<string, string>();
  for (const v of legacyVariants ?? [])
    labelByVariantId.set(v.variantId, v.label);

  const results: DisplayVariant[] = [];

  for (const [variantId, spec] of Object.entries(variantSpecs)) {
    const loc = spec?.locations?.[locationId];
    if (!loc || typeof loc.price !== 'number') continue;

    const available = (loc.qty ?? 0) - (loc.reserved ?? 0);
    const inStock = available > 0;

    results.push({
      variantId,
      label: labelByVariantId.get(variantId) ?? spec.label ?? variantId,
      price: loc.price,
      compareAtPrice: loc.compareAtPrice,
      inStock,
    });
  }

  return results.sort((a, b) => a.price - b.price);
}
