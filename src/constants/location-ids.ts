/**
 * Reserved inventory location IDs — virtual locations with no Firestore
 * Location document. Safe to import in both server and client code.
 */

/**
 * Reserved inventory location ID for the RnR Hub (warehouse/non-physical).
 * Hub items can be flagged availableOnline: true to promote to the storefront.
 */
export const HUB_LOCATION_ID = 'hub';

/**
 * Virtual location ID for online/e-commerce inventory.
 * Storefront pricing and availability is read from inventory/online/items/{productId}.
 */
export const ONLINE_LOCATION_ID = 'online';
