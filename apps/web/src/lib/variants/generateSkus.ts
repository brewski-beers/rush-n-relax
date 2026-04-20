import type {
  VariantGroup,
  VariantOption,
  ProductVariant,
} from '@/types/product';

/**
 * Generates the flat ProductVariant[] from a VariantGroup[] definition.
 *
 * - Standalone groups (combinable: false): each option becomes its own SKU.
 * - Combinable groups (combinable: true): all combinable groups are
 *   cartesian-product expanded into combined SKUs.
 *
 * Example: Flavor ["Berry","Lemon"] × Weight ["1g","3.5g"] (both combinable)
 * → ["Berry | 1g", "Berry | 3.5g", "Lemon | 1g", "Lemon | 3.5g"]
 */
export function generateSkus(groups: VariantGroup[]): ProductVariant[] {
  const combinable = groups.filter(g => g.combinable && g.options.length > 0);
  const standalone = groups.filter(g => !g.combinable && g.options.length > 0);
  const result: ProductVariant[] = [];

  for (const group of standalone) {
    for (const opt of group.options) {
      result.push({ variantId: opt.optionId, label: opt.label });
    }
  }

  if (combinable.length > 0) {
    let matrix: VariantOption[][] = [[]];
    for (const group of combinable) {
      matrix = matrix.flatMap(combo =>
        group.options.map(opt => [...combo, opt])
      );
    }
    for (const combo of matrix) {
      result.push({
        variantId: combo.map(o => o.optionId).join('-'),
        label: combo.map(o => o.label).join(' | '),
      });
    }
  }

  return result;
}
