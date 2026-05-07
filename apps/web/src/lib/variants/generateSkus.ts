import type { VariantGroup, VariantOption } from '@/types/product';

/**
 * A single generated SKU descriptor — the (variantId, label) pair derived
 * from a VariantGroup[] definition. Consumed by the admin product editor
 * to seed the unified `Product.variants` map with empty per-location
 * entries (pricing/qty are filled in later via the stock editor).
 */
export interface GeneratedSku {
  variantId: string;
  label: string;
}

/**
 * Generates the flat SKU list from a VariantGroup[] definition.
 *
 * - Standalone groups (combinable: false): each option becomes its own SKU.
 * - Combinable groups (combinable: true): all combinable groups are
 *   cartesian-product expanded into combined SKUs.
 *
 * Example: Flavor ["Berry","Lemon"] × Weight ["1g","3.5g"] (both combinable)
 * → ["Berry | 1g", "Berry | 3.5g", "Lemon | 1g", "Lemon | 3.5g"]
 */
export function generateSkus(groups: VariantGroup[]): GeneratedSku[] {
  const combinable = groups.filter(g => g.combinable && g.options.length > 0);
  const standalone = groups.filter(g => !g.combinable && g.options.length > 0);
  const result: GeneratedSku[] = [];

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
