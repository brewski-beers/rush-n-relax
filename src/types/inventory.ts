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
  /** Optional unit count — for future staff-facing stock level display */
  quantity?: number;
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
  | 'quantity'
>;
