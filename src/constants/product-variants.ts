export interface ProductVariant {
  key: string;
  label: string;
}

const FLOWER_VARIANTS: ProductVariant[] = [
  { key: 'preroll', label: 'Preroll' },
  { key: 'eighth', label: '1/8 oz' },
  { key: 'quarter', label: '1/4 oz' },
  { key: 'half', label: '1/2 oz' },
  { key: 'ounce', label: '1 oz' },
];

const EDIBLE_VARIANTS: ProductVariant[] = [
  { key: 'single', label: '1pc' },
  { key: 'five-pack', label: '5-pack' },
  { key: 'ten-pack', label: '10-pack' },
];

const DRINK_VARIANTS: ProductVariant[] = [
  { key: 'single', label: 'Single Can' },
  { key: 'two-pack', label: '2-pack' },
];

const CONCENTRATE_VARIANTS: ProductVariant[] = [
  { key: 'half-gram', label: '0.5g' },
  { key: 'gram', label: '1g' },
];

const VAPE_VARIANTS: ProductVariant[] = [
  { key: 'single', label: 'Single Cart' },
  { key: 'two-pack', label: '2-pack' },
];

const VARIANT_MAP: Record<string, ProductVariant[]> = {
  flower: FLOWER_VARIANTS,
  edibles: EDIBLE_VARIANTS,
  drinks: DRINK_VARIANTS,
  concentrates: CONCENTRATE_VARIANTS,
  vapes: VAPE_VARIANTS,
};

const SIZE_LABEL_MAP: Record<string, string> = {
  flower: 'Select Weight',
  edibles: 'Select Quantity',
  drinks: 'Select Quantity',
  concentrates: 'Select Weight',
  vapes: 'Select Quantity',
};

export function getVariantsForCategory(category: string): ProductVariant[] {
  return VARIANT_MAP[category] ?? FLOWER_VARIANTS;
}

export function getSizeLabelForCategory(category: string): string {
  return SIZE_LABEL_MAP[category] ?? 'Select Size';
}
