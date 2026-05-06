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
 *
 * @deprecated Step 1 of variant-model unification (#396). VariantGroups are
 * folded into the unified `Product.variants` map at write time and the field
 * is self-pruned in the same Firestore write. Removed entirely in step 3
 * (#398) when the catalog editor migrates to author the unified shape directly.
 */
export interface VariantGroup {
  groupId: string;
  label: string;
  combinable: boolean;
  options: VariantOption[];
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
  /**
   * Units currently held by in-flight CheckoutSessions (#361). Subtract from
   * `qty` to get available stock. Optional / additive — pre-#361 documents
   * default to 0 via `?? 0` reads. Mutated only by the reservation helpers
   * (`holdStock`, `releaseStock`, `commitStock`) in product.repository.
   *
   * MUST be preserved across the legacy → unified projection performed by
   * the product repository self-pruning writes (#396); losing this field
   * would silently release in-flight CheckoutSession holds.
   */
  reserved?: number;
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
 * The canonical (unified) variant shape — a labelled bundle of per-location
 * pricing/availability entries. Variantless products use a single `default`
 * variant key.
 *
 * Renamed from `ProductVariantSpec` in #396 step 1. The legacy alias
 * `ProductVariantSpec` is retained for the duration of steps 1–2 so step-3
 * callers compile.
 */
export interface ProductVariant {
  label: string;
  /** Keyed by location ID (retail location slug or ONLINE_LOCATION_ID). */
  locations: { [locationId: string]: ProductVariantLocation };
}

/**
 * Legacy array-shaped variant entry. Predates the unified map — authored on
 * the `Product.legacyVariants` field by older fixtures and the catalog
 * editor. The product repository projects these onto the unified
 * `Product.variants` map at write time and self-prunes the legacy field.
 *
 * @deprecated Replaced by `ProductVariant` (the unified map entry) in #396
 * step 1. Removed in #398 step 3.
 */
export interface LegacyProductVariant {
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
 * Visibility, featuring, and pricing live on `variants[*].locations[*]`
 * (per-variant, per-location) under the unified map shape introduced in
 * #396 step 1.
 */
export interface Product {
  /** Firestore document ID (same as slug) */
  id: string;
  slug: string;
  name: string;
  category: string;
  details: string;
  /**
   * Default unit price in cents shown when no variant-specific price is set.
   * Required at create time (#359) so storefront has a price to render even
   * before per-location variant entries are populated.
   */
  price?: number;
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
   * @deprecated #396 step 1 — option dimensions for this product. The
   * product repository folds these into the unified `variants` map at write
   * time and prunes the field. Step 3 (#398) deletes this field and the
   * editor moves to authoring `variants` directly.
   */
  variantGroups?: VariantGroup[];
  /**
   * @deprecated #396 step 1 — legacy hand-authored variant array. Renamed
   * from `variants` so the field name `variants` is free for the unified
   * map (the canonical write target). Repo reads continue to populate this
   * for label-fallback callers (#398 deletes the field outright).
   */
  legacyVariants?: LegacyProductVariant[];
  /**
   * Unified variant catalogue (#396 step 1). Map-keyed by variantId; each
   * entry carries a label and per-location pricing/availability/reservation.
   * Variantless products use the single `default` key.
   *
   * Self-pruning contract: every repository write path projects legacy
   * fields (`variantGroups`, `legacyVariants`, `variantSpecs`) onto this map
   * — preserving qty / price / compareAtPrice / availablePickup / featured /
   * reserved when variantIds match — and deletes the legacy fields in the
   * same Firestore write.
   */
  variants?: { [variantId: string]: ProductVariant };
  /**
   * Denormalized list of location IDs where this product has at least one
   * variant with `qty - (reserved ?? 0) > 0`. Recomputed by the product
   * repository on every write. Powers storefront list queries via
   * array-contains.
   */
  inStockAt?: string[];
  /**
   * Denormalized list of retail location IDs where this product has at
   * least one variant with `availablePickup === true` and available stock.
   */
  pickupAt?: string[];
  /**
   * Denormalized list of location IDs where this product has at least one
   * variant marked `featured` and with available stock.
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
  | 'legacyVariants'
  | 'variantGroups'
  | 'leaflyUrl'
  | 'variants'
  | 'inStockAt'
  | 'featuredAt'
>;
