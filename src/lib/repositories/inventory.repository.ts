/**
 * Inventory repository — all Firestore access for inventory documents.
 * Server-side only (uses firebase-admin).
 *
 * Inventory items live in a subcollection scoped per location:
 *   tenants/{tenantId}/inventory/{locationId}/items/{productId}
 *
 * locationId can be a retail location doc ID or HUB_LOCATION_ID ('hub').
 */
import {
  getAdminFirestore,
  toDate,
  DEFAULT_TENANT_ID,
} from '@/lib/firebase/admin';
import type { InventoryItem, InventoryItemSummary } from '@/types';

// ── Collection helpers ────────────────────────────────────────────────────

function inventoryItemsCol(
  locationId: string,
  tenantId: string = DEFAULT_TENANT_ID
) {
  return getAdminFirestore().collection(
    `tenants/${tenantId}/inventory/${locationId}/items`
  );
}

// ── Read operations ───────────────────────────────────────────────────────

/**
 * List all inventory items for a location.
 * Returns an empty array if no items have been tracked yet.
 */
export async function listInventoryForLocation(
  locationId: string,
  tenantId: string = DEFAULT_TENANT_ID
): Promise<InventoryItem[]> {
  const snap = await inventoryItemsCol(locationId, tenantId).get();
  return snap.docs.map(doc => docToInventoryItem(doc.id, doc.data()));
}

/**
 * Fetch a single inventory item for a product at a location.
 * Returns null if the item has not been tracked yet.
 * Callers should treat null as { inStock: false, availableOnline: false }.
 */
export async function getInventoryItem(
  locationId: string,
  productId: string,
  tenantId: string = DEFAULT_TENANT_ID
): Promise<InventoryItem | null> {
  const doc = await inventoryItemsCol(locationId, tenantId)
    .doc(productId)
    .get();
  if (!doc.exists) return null;
  return docToInventoryItem(doc.id, doc.data()!);
}

/**
 * List all hub inventory items that are flagged as available online.
 * Used by the storefront (Phase 3A) to show products available for purchase.
 */
export async function listOnlineAvailableInventory(
  tenantId: string = DEFAULT_TENANT_ID
): Promise<InventoryItemSummary[]> {
  const snap = await inventoryItemsCol('hub', tenantId)
    .where('availableOnline', '==', true)
    .where('inStock', '==', true)
    .get();

  return snap.docs.map(doc => {
    const d = doc.data();
    return {
      productId: doc.id,
      locationId: 'hub',
      inStock: d.inStock ?? false,
      availableOnline: d.availableOnline ?? false,
      quantity: d.quantity ?? undefined,
    } satisfies InventoryItemSummary;
  });
}

// ── Write operations ──────────────────────────────────────────────────────

/**
 * Create or update an inventory item (merge: true).
 * Document ID is the productId — one record per product per location.
 */
export async function setInventoryItem(
  locationId: string,
  productId: string,
  patch: {
    inStock: boolean;
    availableOnline?: boolean;
    quantity?: number;
    notes?: string;
    updatedBy?: string;
  },
  tenantId: string = DEFAULT_TENANT_ID
): Promise<void> {
  await inventoryItemsCol(locationId, tenantId)
    .doc(productId)
    .set(
      {
        productId,
        locationId,
        inStock: patch.inStock,
        availableOnline: patch.availableOnline ?? false,
        ...(patch.quantity !== undefined && { quantity: patch.quantity }),
        ...(patch.notes !== undefined && { notes: patch.notes }),
        ...(patch.updatedBy !== undefined && { updatedBy: patch.updatedBy }),
        updatedAt: new Date(),
      },
      { merge: true }
    );
}

// ── Private helpers ───────────────────────────────────────────────────────

function docToInventoryItem(
  id: string,
  d: FirebaseFirestore.DocumentData
): InventoryItem {
  return {
    productId: id,
    locationId: d.locationId,
    inStock: d.inStock ?? false,
    availableOnline: d.availableOnline ?? false,
    quantity: d.quantity ?? undefined,
    notes: d.notes ?? undefined,
    updatedAt: toDate(d.updatedAt),
    updatedBy: d.updatedBy ?? undefined,
  };
}
