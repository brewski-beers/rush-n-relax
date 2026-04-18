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
 *   - featured = false when inStock = false (online location only)
 *   - Every mutation writes an immutable adjustment record
 */
import {
  getAdminFirestore,
  toDate,
  HUB_LOCATION_ID,
  ONLINE_LOCATION_ID,
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
 * List all online inventory items that are in stock.
 * Reads from inventory/online (ONLINE_LOCATION_ID) — the canonical path
 * for storefront pricing. Each item's variantPricing map drives the
 * variant selector on the product detail page.
 */
export async function listOnlineAvailableInventory(): Promise<
  InventoryItemSummary[]
> {
  const snap = await inventoryItemsCol(ONLINE_LOCATION_ID)
    .where('inStock', '==', true)
    .get();

  return snap.docs.map(doc => {
    const d = doc.data();
    return {
      productId: doc.id,
      locationId: ONLINE_LOCATION_ID,
      inStock: d.inStock ?? false,
      availableOnline: d.availableOnline ?? false,
      availablePickup: false,
      featured: d.featured ?? false,
      quantity: d.quantity ?? undefined,
      variantPricing: docToVariantPricing(d.variantPricing),
    } satisfies InventoryItemSummary;
  });
}

/**
 * List featured inventory items for a location.
 *
 * Hub: returns items where featured = true. Invariants guarantee availableOnline
 * and inStock are also true. Used to populate homepage "What We Carry".
 *
 * Retail: returns items where featured = true. Invariants guarantee inStock is
 * also true. Used to populate per-store featured sections.
 */
export async function listFeaturedInventory(
  locationId: string
): Promise<InventoryItemSummary[]> {
  const snap = await inventoryItemsCol(locationId)
    .where('featured', '==', true)
    .get();

  return snap.docs.map(doc => {
    const d = doc.data();
    return {
      productId: doc.id,
      locationId,
      inStock: d.inStock ?? false,
      availableOnline: d.availableOnline ?? false,
      availablePickup: d.availablePickup ?? false,
      featured: true,
      quantity: d.quantity ?? undefined,
      variantPricing: docToVariantPricing(d.variantPricing),
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
    featured?: boolean;
    quantity?: number;
    notes?: string;
    updatedBy?: string;
    /** Partial variantPricing update — merged with existing pricing at the Firestore level */
    variantPricing?: InventoryItem['variantPricing'];
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
  const isHub = locationId === HUB_LOCATION_ID;

  const currentQuantity = normalizeQuantity(
    current?.quantity,
    current?.inStock ?? false
  );
  const currentInStock: boolean = current?.inStock ?? false;
  const currentAvailableOnline: boolean = current?.availableOnline ?? false;
  const currentAvailablePickup: boolean = current?.availablePickup ?? false;
  const currentFeatured: boolean = current?.featured ?? false;

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
  const requestedFeatured = patch.featured ?? currentFeatured;

  const nextAvailableOnline = nextInStock ? requestedAvailableOnline : false;
  const nextAvailablePickup = nextInStock ? requestedAvailablePickup : false;
  // Hub: featured requires availableOnline; all locations: featured requires inStock
  const nextFeatured = isHub
    ? nextAvailableOnline && requestedFeatured
    : nextInStock && requestedFeatured;

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
    featured: nextFeatured,
    ...(patch.notes !== undefined && { notes: patch.notes }),
    ...(patch.variantPricing !== undefined && {
      variantPricing: patch.variantPricing,
    }),
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
    if (nextFeatured !== currentFeatured) changedFields.push('featured');
    if (
      patch.notes !== undefined &&
      patch.notes !== (current?.notes ?? undefined)
    )
      changedFields.push('notes');
    if (patch.variantPricing !== undefined)
      changedFields.push('variantPricing');

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
      previousFeatured: currentFeatured,
      nextFeatured,
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
  const availableOnline = inStock ? (d.availableOnline ?? false) : false;

  return {
    productId: id,
    locationId: d.locationId,
    inStock,
    availableOnline,
    availablePickup: inStock ? (d.availablePickup ?? false) : false,
    // featured requires inStock; for hub it also requires availableOnline
    featured: inStock ? (d.featured ?? false) : false,
    quantity,
    variantPricing: docToVariantPricing(d.variantPricing),
    notes: d.notes ?? undefined,
    updatedAt: toDate(d.updatedAt),
    updatedBy: d.updatedBy ?? undefined,
  };
}

/**
 * Defensively maps variantPricing from Firestore.
 * Entries with non-numeric price are silently skipped.
 * Returns undefined if the field is absent or contains no valid entries.
 */
function docToVariantPricing(
  raw: unknown
): InventoryItem['variantPricing'] | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const result: NonNullable<InventoryItem['variantPricing']> = {};
  let hasEntry = false;
  for (const [variantId, entry] of Object.entries(
    raw as Record<string, unknown>
  )) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.price !== 'number') continue;
    result[variantId] = {
      price: e.price,
      compareAtPrice:
        typeof e.compareAtPrice === 'number' ? e.compareAtPrice : undefined,
      inStock: typeof e.inStock === 'boolean' ? e.inStock : undefined,
    };
    hasEntry = true;
  }
  return hasEntry ? result : undefined;
}

function normalizeQuantity(value: unknown, fallbackInStock: boolean): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  return fallbackInStock ? 1 : 0;
}
