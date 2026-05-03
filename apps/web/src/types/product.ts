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
 *
 * @deprecated Legacy array-shaped variant. Replaced by `ProductVariantSpec`
 * (map-based, per-location pricing) under #304/#305. Removed in #312.
 */
export interface ProductVariant {
  variantId: string;
  label: string;
  weight?: { value: number; unit: 'g' | 'oz' };
  quantity?: number;
  dose?: { value: number; unit: 'mg' | 'mcg' };
}

/**
 * Per-location pricing and availability for a single product variant.
 * Part of the inventory-into-product initiative (#304) — replaces the
 * inventory/{locationId}/items/{productId} sub-collection model.
 *
 * `qty` and `price` (cents) are required when a variant is stocked at a
 * given location. `availablePickup` applies to retail locations only and
 * has no meaning for the online store. `featured` marks the variant for
 * spotlighting at that location.
 */
export interface ProductVariantLocation {
  qty: number;
  /** Unit price in cents */
  price: number;
  /** Optional MSRP in cents — when present, used to render a strike-through */
  compareAtPrice?: number;
  /** Retail locations only — true if eligible for in-store pickup. */
  availablePickup?: boolean;
  /** When true, variant is spotlighted at this location. */
  featured?: boolean;
}

/**
 * New map-based variant shape introduced by #305 (parent #304).
 * A variant has a human label and a map of per-location availability /
 * pricing keyed by location ID. Variantless products use a single
 * `default` variant key (data migration in #307).
 *
 * Named `ProductVariantSpec` to avoid colliding with the legacy
 * array-shaped `ProductVariant` type, which remains in place during the
 * parallel-write window. The legacy type is removed in #312, at which
 * point this type will be renamed to `ProductVariant`.
 */
export interface ProductVariantSpec {
  label: string;
  /** Keyed by location ID (retail location slug or ONLINE_LOCATION_ID). */
  locations: { [locationId: string]: ProductVariantLocation };
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
  /**
   * NEW (#305) — map-based variant catalogue with per-location stock,
   * pricing, pickup, and featured flags. Co-exists with the legacy
   * `variants` array during the parallel-write window. Uses a map (not an
   * array) so Firestore field-path atomic updates target individual
   * variants. Variantless products use a single `default` key (#307).
   *
   * Naming: field is `variantSpecs` to avoid colliding with the legacy
   * `variants` field. Renamed in #312 cleanup.
   */
  variantSpecs?: { [variantId: string]: ProductVariantSpec };
  /**
   * NEW (#305) — denormalized list of location IDs where this product has
   * at least one variant with `qty > 0`. Recomputed by the product
   * repository on writes. Powers storefront list queries via array-contains.
   */
  inStockAt?: string[];
  /**
   * NEW (#305) — denormalized list of retail location IDs where this
   * product has at least one variant with `availablePickup === true` and
   * `qty > 0`. Recomputed by the product repository on writes.
   */
  pickupAt?: string[];
  /**
   * NEW (#305) — denormalized list of location IDs where this product has
   * at least one variant marked `featured` and in stock. Recomputed by the
   * product repository on writes.
   */
  featuredAt?: string[];
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
