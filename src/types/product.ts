export type ProductStatus =
  | 'active'
  | 'pending-reformulation'
  | 'archived'
  | 'compliance-hold';

export type ProductStrain = 'indica' | 'sativa' | 'hybrid' | 'cbd';

export interface LabResults {
  thcPercent?: number;
  cbdPercent?: number;
  terpenes?: string[];
  /** ISO date string, e.g. "2025-01-15" */
  testDate?: string;
  labName?: string;
}

/**
 * FDA-style Nutrition Facts for edible products.
 * All per-serving macronutrient fields are optional strings matching FDA label conventions.
 */
export interface NutritionFacts {
  /** e.g. "1 gummy (5g)" */
  servingSize: string;
  servingsPerContainer: number;
  calories: number;
  totalFat?: string;
  sodium?: string;
  totalCarbs?: string;
  sugars?: string;
  protein?: string;
}

/**
 * A single option within a VariantGroup (e.g. "Berry" in a Flavor group).
 */
export interface VariantOption {
  optionId: string;
  label: string;
}

/**
 * A dimension of purchasable options (e.g. Flavor, Quantity, Weight).
 * When `combinable` is true, this group participates in the cartesian-product
 * SKU generation along with all other combinable groups.
 */
export interface VariantGroup {
  groupId: string;
  label: string;
  combinable: boolean;
  options: VariantOption[];
}

/**
 * A single purchasable variant of a product (e.g. "1/8 oz", "10mg gummy").
 * Variants are authored at the product level and priced at the inventory level
 * via InventoryItem.variantPricing.
 */
export interface ProductVariant {
  variantId: string;
  label: string;
  weight?: { value: number; unit: 'g' | 'oz' };
  quantity?: number;
  dose?: { value: number; unit: 'mg' | 'mcg' };
}

/**
 * Firestore document shape for a product.
 * Lives at: products/{slug}
 *
 * Visibility and featuring are controlled at the inventory level
 * (inventory/{locationId}/items/{productId}.featured), not here.
 * Pricing is controlled at the inventory level via InventoryItem.variantPricing.
 */
export interface Product {
  /** Firestore document ID (same as slug) */
  id: string;
  slug: string;
  name: string;
  category: string;
  details: string;
  /** Firebase Storage path, e.g. products/{slug}.jpg */
  image?: string;
  /** Firebase Storage paths for the gallery (up to 5), e.g. products/{slug}/gallery/0.jpg */
  images?: string[];
  status: ProductStatus;
  /** Link to Certificate of Analysis — required for compliance documentation */
  coaUrl?: string;
  /** Location slugs where this product is carried, e.g. ['oak-ridge', 'seymour'] */
  availableAt: string[];
  /** References vendors/{slug} */
  vendorSlug?: string;
  /** RnR-owned lab result data (replaces generic coaUrl where available) */
  labResults?: LabResults;
  /** Leafly product page URL — flower only */
  leaflyUrl?: string;
  /** Direct product page URL on the vendor's own site */
  vendorProductUrl?: string;
  /** Cannabis strain type — powers strain badge on storefront */
  strain?: ProductStrain;
  /** Consumer-facing effect descriptors, e.g. ['Euphoria', 'Relaxed', 'Sedative'] */
  effects?: string[];
  /** Flavor/taste descriptors, e.g. ['Citrus', 'Pine', 'Berry'] */
  flavors?: string[];
  /**
   * Option dimensions for this product (e.g. Flavor, Weight).
   * Combinable groups are cartesian-product expanded into `variants` on save.
   */
  variantGroups?: VariantGroup[];
  /**
   * Denormalized flat variant list — computed from variantGroups on save via generateSkus().
   * Also accepts legacy hand-authored variants for products without variantGroups.
   * Priced per-variant at the inventory level via InventoryItem.variantPricing.
   */
  variants?: ProductVariant[];
  /** FDA-style nutrition facts — edibles and drinks (serving info). */
  nutritionFacts?: NutritionFacts;
  // ── Vape-specific ──────────────────────────────────────────────────────────
  /** e.g. "live-resin" | "distillate" | "full-spectrum" | "broad-spectrum" */
  extractionType?: string;
  /** e.g. "cartridge" | "disposable" | "all-in-one" */
  hardwareType?: string;
  /** Volume in millilitres, e.g. 0.5, 1.0 */
  volumeMl?: number;
  // ── Drink-specific ─────────────────────────────────────────────────────────
  /** THC content in mg per serving */
  thcMgPerServing?: number;
  /** CBD content in mg per serving */
  cbdMgPerServing?: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductSummary = Pick<
  Product,
  | 'id'
  | 'slug'
  | 'name'
  | 'category'
  | 'image'
  | 'images'
  | 'status'
  | 'availableAt'
  | 'vendorSlug'
  | 'strain'
  | 'variants'
  | 'variantGroups'
  | 'leaflyUrl'
>;
