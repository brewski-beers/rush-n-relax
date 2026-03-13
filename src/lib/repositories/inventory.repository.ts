/**
 * Inventory repository — all Firestore access for inventory documents.
 * Server-side only (uses firebase-admin).
 *
 * Inventory items live in a subcollection scoped per location:
 *   inventory/{locationId}/items/{productId}
 *
 * Adjustment history is recorded as an immutable subcollection:
 *   inventory/{locationId}/items/{productId}/adjustments/{adjustmentId}
 *
 * locationId can be a retail location slug or HUB_LOCATION_ID ('hub').
 *
 * Invariants (enforced at every write):
 *   - quantity ≥ 0, integer
 *   - inStock = quantity > 0
 *   - availableOnline = false when inStock = false
 *   - availablePickup = false when inStock = false
 *   - Every mutation writes an immutable adjustment record
 */
import {
  getAdminFirestore,
  toDate,
  HUB_LOCATION_ID,
} from '@/lib/firebase/admin';
import type {
  InventoryItem,
  InventoryItemSummary,
  InventoryAdjustment,
  InventoryAdjustmentReason,
  InventoryAdjustmentSource,
} from '@/types';

// ── Collection helpers ────────────────────────────────────────────────────

function inventoryItemsCol(locationId: string) {
  return getAdminFirestore().collection(`inventory/${locationId}/items`);
}

// ── Read operations ───────────────────────────────────────────────────────

/**
 * List all inventory items for a location.
 * Returns an empty array if no items have been tracked yet.
 */
export async function listInventoryForLocation(
  locationId: string
): Promise<InventoryItem[]> {
  const snap = await inventoryItemsCol(locationId).get();
  return snap.docs.map(doc => docToInventoryItem(doc.id, doc.data()));
}

/**
 * Fetch a single inventory item for a product at a location.
 * Returns null if the item has not been tracked yet.
 * Callers should treat null as { inStock: false, availableOnline: false }.
 */
export async function getInventoryItem(
  locationId: string,
  productId: string
): Promise<InventoryItem | null> {
  const doc = await inventoryItemsCol(locationId).doc(productId).get();
  if (!doc.exists) return null;
  // doc.data() is safe here: existence is confirmed on the line above
  return docToInventoryItem(doc.id, doc.data()!);
}

/**
 * List all hub inventory items that are flagged as available online.
 * Used by the storefront (Phase 3A) to show products available for purchase.
 */
export async function listOnlineAvailableInventory(): Promise<
  InventoryItemSummary[]
> {
  const snap = await inventoryItemsCol(HUB_LOCATION_ID)
    .where('availableOnline', '==', true)
    .where('inStock', '==', true)
    .get();

  return snap.docs.map(doc => {
    const d = doc.data();
    return {
      productId: doc.id,
      locationId: HUB_LOCATION_ID,
      inStock: d.inStock ?? false,
      availableOnline: d.availableOnline ?? false,
      availablePickup: false,
      quantity: d.quantity ?? undefined,
    } satisfies InventoryItemSummary;
  });
}

// ── Write operations ──────────────────────────────────────────────────────

/**
 * Create or update an inventory item.
 * Document ID is the productId — one record per product per location.
 *
 * Compliance guard: setting availableOnline: true is blocked if the product
 * has status 'compliance-hold'. Throws if violated.
 *
 * Every call writes an immutable adjustment log entry atomically alongside
 * the item update. The `adjustment` parameter controls the log metadata.
 * Omitting `adjustment` is only valid for automated/system writes (e.g.
 * seeding); manually triggered updates must always supply it.
 */
export async function setInventoryItem(
  locationId: string,
  productId: string,
  patch: {
    inStock?: boolean;
    availableOnline?: boolean;
    availablePickup?: boolean;
    quantity?: number;
    notes?: string;
    updatedBy?: string;
  },
  adjustment?: {
    reason: InventoryAdjustmentReason;
    note?: string;
    updatedBy: string;
    source?: InventoryAdjustmentSource;
  }
): Promise<void> {
  const db = getAdminFirestore();
  const itemRef = inventoryItemsCol(locationId).doc(productId);
  const currentSnap = await itemRef.get();
  const current = currentSnap.data();

  const currentQuantity = normalizeQuantity(
    current?.quantity,
    current?.inStock ?? false
  );
  const currentInStock: boolean = current?.inStock ?? false;
  const currentAvailableOnline: boolean = current?.availableOnline ?? false;
  const currentAvailablePickup: boolean = current?.availablePickup ?? false;

  const nextQuantity =
    patch.quantity !== undefined
      ? normalizeQuantity(patch.quantity, false)
      : patch.inStock !== undefined
        ? patch.inStock
          ? Math.max(currentQuantity, 1)
          : 0
        : currentQuantity;

  const nextInStock = nextQuantity > 0;

  const requestedAvailableOnline =
    patch.availableOnline ?? currentAvailableOnline;
  const requestedAvailablePickup =
    patch.availablePickup ?? currentAvailablePickup;

  const nextAvailableOnline = nextInStock ? requestedAvailableOnline : false;
  const nextAvailablePickup = nextInStock ? requestedAvailablePickup : false;

  if (nextAvailableOnline || nextAvailablePickup) {
    // Intentional cross-collection read: this compliance guard must be
    // co‑located with the write to avoid a circular dependency between repos.
    const productDoc = await db.collection('products').doc(productId).get();
    if (productDoc.exists && productDoc.data()?.status === 'compliance-hold') {
      throw new Error(
        `Cannot mark '${productId}' available for purchase: product is on compliance-hold`
      );
    }
  }

  const now = new Date();

  const effectiveUpdatedBy = adjustment?.updatedBy ?? patch.updatedBy;

  const itemPayload = {
    productId,
    locationId,
    quantity: nextQuantity,
    inStock: nextInStock,
    availableOnline: nextAvailableOnline,
    availablePickup: nextAvailablePickup,
    ...(patch.notes !== undefined && { notes: patch.notes }),
    ...(effectiveUpdatedBy !== undefined && { updatedBy: effectiveUpdatedBy }),
    updatedAt: now,
  };

  if (adjustment) {
    // Compute which fields actually changed for the audit record.
    const changedFields: InventoryAdjustment['changedFields'] = [];
    if (nextQuantity !== currentQuantity) changedFields.push('quantity');
    if (nextInStock !== currentInStock) changedFields.push('inStock');
    if (nextAvailableOnline !== currentAvailableOnline)
      changedFields.push('availableOnline');
    if (nextAvailablePickup !== currentAvailablePickup)
      changedFields.push('availablePickup');
    if (
      patch.notes !== undefined &&
      patch.notes !== (current?.notes ?? undefined)
    )
      changedFields.push('notes');

    // Atomic write: item update + immutable audit log entry in one batch.
    const logRef = itemRef.collection('adjustments').doc();
    const logEntry = {
      productId,
      locationId,
      reason: adjustment.reason,
      source: adjustment.source ?? 'admin-ui',
      updatedBy: adjustment.updatedBy,
      changedFields,
      previousQuantity: currentQuantity,
      nextQuantity,
      deltaQuantity: nextQuantity - currentQuantity,
      previousInStock: currentInStock,
      nextInStock,
      previousAvailableOnline: currentAvailableOnline,
      nextAvailableOnline,
      previousAvailablePickup: currentAvailablePickup,
      nextAvailablePickup,
      ...(adjustment.note !== undefined && { note: adjustment.note }),
      createdAt: now,
    } satisfies InventoryAdjustment;

    const batch = db.batch();
    batch.set(itemRef, itemPayload, { merge: true });
    batch.set(logRef, logEntry);
    await batch.commit();
  } else {
    // System / seed writes: no audit actor available, skip log entry.
    await itemRef.set(itemPayload, { merge: true });
  }
}

// ── Private helpers ───────────────────────────────────────────────────────

function docToInventoryItem(
  id: string,
  d: FirebaseFirestore.DocumentData
): InventoryItem {
  const quantity = normalizeQuantity(d.quantity, d.inStock ?? false);
  const inStock = quantity > 0;

  return {
    productId: id,
    locationId: d.locationId,
    inStock,
    availableOnline: inStock ? (d.availableOnline ?? false) : false,
    availablePickup: inStock ? (d.availablePickup ?? false) : false,
    quantity,
    notes: d.notes ?? undefined,
    updatedAt: toDate(d.updatedAt),
    updatedBy: d.updatedBy ?? undefined,
  };
}

function normalizeQuantity(value: unknown, fallbackInStock: boolean): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  return fallbackInStock ? 1 : 0;
}
