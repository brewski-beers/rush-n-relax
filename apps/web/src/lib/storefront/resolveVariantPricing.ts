/**
 * resolveVariantPricing — pure pricing resolution for the storefront.
 *
 * Merges Product.variants with InventoryItem.variantPricing to produce a
 * display-ready list. No Firestore calls — safe to use in both Server
 * Components and client-side code.
 */
import type { ProductVariant } from '@/types/product';
import type { InventoryItem } from '@/types/inventory';

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
 * - Only variants that have an entry in `variantPricing` are included.
 * - `inStock` comes from the variant-level pricing entry when present;
 *   otherwise it inherits from `itemInStock`.
 * - Results are sorted by price ascending.
 * - Returns `[]` when `variantPricing` is undefined/empty or `variants` is empty.
 */
export function resolveVariantPricing(
  variants: ProductVariant[] | undefined,
  variantPricing: InventoryItem['variantPricing'],
  itemInStock = true
): DisplayVariant[] {
  if (!variants?.length || !variantPricing) return [];

  const results: DisplayVariant[] = [];

  for (const variant of variants) {
    const pricing = variantPricing[variant.variantId];
    if (!pricing) continue; // no price set — exclude from storefront

    const inStock =
      typeof pricing.inStock === 'boolean' ? pricing.inStock : itemInStock;

    results.push({
      variantId: variant.variantId,
      label: variant.label,
      price: pricing.price,
      compareAtPrice: pricing.compareAtPrice,
      inStock,
    });
  }

  return results.sort((a, b) => a.price - b.price);
}
