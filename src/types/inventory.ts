/**
 * Inventory item — tracks stock status for a single product at a single location.
 * Lives at: tenants/{tenantId}/inventory/{locationId}/items/{productId}
 *
 * locationId can be a retail location doc ID or HUB_LOCATION_ID ('hub').
 * Hub items support availableOnline to promote stock to the storefront.
 */
export interface InventoryItem {
  /** References tenants/{tenantId}/products/{productId} */
  productId: string;
  /** Retail location doc ID or HUB_LOCATION_ID */
  locationId: string;
  /** Whether this product is currently in stock at this location */
  inStock: boolean;
  /**
   * Hub items only — when true, this product is listed as available
   * for online purchase (Phase 3A checkout reads this flag).
   * Always false for retail locations.
   */
  availableOnline: boolean;
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
  'productId' | 'locationId' | 'inStock' | 'availableOnline' | 'quantity'
>;
