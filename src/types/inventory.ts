/**
 * Inventory item — tracks stock status for a single product at a single location.
 * Lives at: inventory/{locationId}/items/{productId}
 *
 * locationId can be a retail location slug or HUB_LOCATION_ID ('hub').
 * Hub items support availableOnline to promote stock to the storefront.
 */
export interface InventoryItem {
  /** References products/{productId} */
  productId: string;
  /** Retail location doc ID or HUB_LOCATION_ID */
  locationId: string;
  /** Whether this product is currently in stock at this location */
  inStock: boolean;
  /**
   * Hub only — when true, product is listed for online purchase and ships from hub.
   * Always false for retail locations.
   */
  availableOnline: boolean;
  /**
   * Retail locations only — when true, product can be purchased online for
   * in-store pickup at this location. Deducts from this location's inventory.
   * Always false for hub.
   */
  availablePickup: boolean;
  /**
   * When true, product is spotlighted at this location.
   * Hub: shown in homepage "What We Carry" (requires availableOnline = true).
   * Retail: shown in per-store featured section (requires inStock = true).
   * Always false when inStock = false; hub also clears when availableOnline = false.
   */
  featured: boolean;
  /** Optional unit count — for future staff-facing stock level display */
  quantity?: number;
  /**
   * Per-variant pricing for this product at this location.
   * Keys are variantId values from Product.variants.
   * Missing variantId means no price has been set for that variant.
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
  previousAvailableOnline: boolean;
  nextAvailableOnline: boolean;
  previousAvailablePickup: boolean;
  nextAvailablePickup: boolean;
  previousFeatured: boolean;
  nextFeatured: boolean;
  note?: string;
  createdAt: Date;
}
