/**
 * Inventory item — tracks stock status for a single product at a single location.
 * Lives at: inventory/{locationId}/items/{productId}
 *
 * Storefront visibility is now derived from `inStock` at the online location
 * (see location-ids.ts — ONLINE_LOCATION_ID). The legacy `availableOnline`
 * flag has been retired; the persisted field was dropped by migration #231.
 *
 * @deprecated The entire `inventory/{locationId}/items/{productId}`
 * sub-collection is being folded into the `Product` document under #304
 * (per-variant, per-location stock + price live on `Product.variantSpecs`,
 * with denorm `inStockAt`/`pickupAt`/`featuredAt` arrays for queries).
 * Schema in #305 (this ticket — types only). Migration in #307. Call-site
 * migration in #311. Sub-collection retired in #312. Do not add new
 * dependencies on this shape.
 */
export interface InventoryItem {
  /** References products/{productId} */
  productId: string;
  /** Retail location doc ID or ONLINE_LOCATION_ID */
  locationId: string;
  /**
   * Whether this product is currently in stock at this location.
   * @deprecated Folded into `Product.variantSpecs[*].locations[locationId].qty`
   * + denorm `Product.inStockAt[]` under #304/#305. Removed in #312.
   */
  inStock: boolean;
  /**
   * @deprecated Retired in #232 — no longer persisted or read by the
   * repository. Remains as an optional field so pending consumer code
   * (admin UI, server actions, fixtures) continues to compile until their
   * own removal tickets land (#233 actions, #234 UI). New code MUST NOT
   * rely on this field.
   */
  availableOnline?: boolean;
  /**
   * Retail locations only — when true, product can be purchased online for
   * in-store pickup at this location. Deducts from this location's inventory.
   * Always false for Online Store.
   * @deprecated Folded into
   * `Product.variantSpecs[*].locations[locationId].availablePickup` + denorm
   * `Product.pickupAt[]` under #304/#305. Removed in #312.
   */
  availablePickup: boolean;
  /**
   * When true, product is spotlighted at this location.
   * Online Store: shown in homepage "What We Carry" (requires inStock = true).
   * Retail: shown in per-store featured section (requires inStock = true).
   * Always false when inStock = false.
   * @deprecated Folded into
   * `Product.variantSpecs[*].locations[locationId].featured` + denorm
   * `Product.featuredAt[]` under #304/#305. Removed in #312.
   */
  featured: boolean;
  /** Optional unit count — for future staff-facing stock level display */
  quantity?: number;
  /**
   * Per-variant pricing for this product at this location.
   * Keys are variantId values from Product.variants.
   * Missing variantId means no price has been set for that variant.
   * @deprecated Folded into
   * `Product.variantSpecs[variantId].locations[locationId]` ({ price,
   * compareAtPrice, qty }) under #304/#305. Removed in #312.
   */
  variantPricing?: {
    [variantId: string]: {
      price: number;
      compareAtPrice?: number;
      inStock?: boolean;
    };
  };
  /** Admin freetext — e.g. "waiting on restock", "holds only" */
  notes?: string;
  updatedAt: Date;
  /** Email of the admin who last updated this record */
  updatedBy?: string;
}

export type InventoryItemSummary = Pick<
  InventoryItem,
  | 'productId'
  | 'locationId'
  | 'inStock'
  | 'availableOnline'
  | 'availablePickup'
  | 'featured'
  | 'quantity'
  | 'variantPricing'
>;

export type InventoryAdjustmentReason =
  | 'manual-count'
  | 'toggle-stock'
  | 'toggle-online'
  | 'toggle-pickup'
  | 'toggle-featured'
  | 'system-sync'
  | 'correction'
  | 'price-update';

export type InventoryAdjustmentSource = 'admin-ui' | 'system' | 'api';

/**
 * Immutable audit record for a single inventory mutation.
 * Lives at: inventory/{locationId}/items/{productId}/adjustments/{adjustmentId}
 *
 * `availableOnline` tracking fields are retained for schema backward-compat
 * with historic adjustment documents. New records always write `false` for
 * previous/next availableOnline (the field is no longer mutated — see #232).
 */
export interface InventoryAdjustment {
  productId: string;
  locationId: string;
  reason: InventoryAdjustmentReason;
  source: InventoryAdjustmentSource;
  updatedBy: string;
  changedFields: Array<
    | 'quantity'
    | 'inStock'
    | 'availableOnline'
    | 'availablePickup'
    | 'featured'
    | 'notes'
    | 'variantPricing'
  >;
  previousQuantity: number;
  nextQuantity: number;
  deltaQuantity: number;
  previousInStock: boolean;
  nextInStock: boolean;
  /** @deprecated Always false — `availableOnline` is no longer persisted. */
  previousAvailableOnline: boolean;
  /** @deprecated Always false — `availableOnline` is no longer persisted. */
  nextAvailableOnline: boolean;
  previousAvailablePickup: boolean;
  nextAvailablePickup: boolean;
  previousFeatured: boolean;
  nextFeatured: boolean;
  note?: string;
  createdAt: Date;
}
