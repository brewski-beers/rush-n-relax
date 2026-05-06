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
 * STABLE — option-dimension authoring source (Path A, finalized in #399).
 * `variantGroups` is the canonical input for the multi-dimensional variant
 * selector on the storefront PDP and is the authoring shape used by the
 * admin catalog editor. It is intentionally distinct from the unified
 * `variants` map: `variantGroups` describes the *axis configuration*
 * (e.g. "Weight has options 1g/3.5g/7g"), while `variants` carries the
 * per-leaf pricing/stock reality. Both are persisted on the product doc.
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
 */
export interface ProductVariant {
  label: string;
  /** Keyed by location ID (retail location slug or ONLINE_LOCATION_ID). */
  locations: { [locationId: string]: ProductVariantLocation };
}

/**
 * Legacy array-shaped variant entry. Predates the unified map — authored on
 * the `Product.legacyVariants` field by older catalog seed data. The product
 * repository projects these onto the unified `Product.variants` map at write
 * time and self-prunes the legacy field.
 *
 * STABLE pending PDP refactor (#399 / Path A): the storefront PDP still
 * reads this field for the "see in store" multi-dim fallback when no
 * unified `variants` data exists. Removal is tracked separately and is
 * out of scope for the variant-model unification (#395).
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
   * STABLE — option-dimension authoring source (Path A, #399). Carries the
   * group-shaped axis configuration that the multi-dimensional variant
   * selector on the storefront PDP and the admin catalog editor both
   * consume. Intentionally distinct from `variants` (which carries the
   * per-leaf pricing/stock reality). Both fields coexist on the product
   * doc; neither subsumes the other.
   */
  variantGroups?: VariantGroup[];
  /**
   * STABLE pending PDP refactor (#399 / Path A). Legacy hand-authored
   * variant array still consumed by the storefront PDP for the "see in
   * store" fallback when no unified `variants` data exists. Repo writes
   * self-prune this field on save through `upsertProduct`; reads
   * back-populate it from the array when present so PDP code can keep
   * working until the fallback is migrated.
   */
  legacyVariants?: LegacyProductVariant[];
  /**
   * Unified variant catalogue. Map-keyed by variantId; each entry carries a
   * label and per-location pricing/availability/reservation. Variantless
   * products use the single `default` key. This is the canonical pricing
   * and stock source — read by storefront, admin, and cart-availability.
   *
   * Self-pruning contract: every repository write path projects any
   * `legacyVariants` onto this map — preserving qty / price /
   * compareAtPrice / availablePickup / featured / reserved when variantIds
   * match — and deletes the legacy field in the same Firestore write.
   * `variantGroups` is intentionally NOT pruned — it is a stable
   * authored field per Path A.
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
