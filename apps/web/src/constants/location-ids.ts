/**
 * Reserved inventory location IDs — virtual locations with no Firestore
 * Location document. Safe to import in both server and client code.
 */

/**
 * Virtual location ID for online/e-commerce inventory.
 * Storefront pricing and availability is read from inventory/online/items/{productId}.
 */
export const ONLINE_LOCATION_ID = 'online';
