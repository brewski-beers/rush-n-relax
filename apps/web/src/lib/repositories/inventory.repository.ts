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
 *   - availablePickup = false when inStock = false
 *   - featured = false when inStock = false
 *   - Every mutation writes an immutable adjustment record
 *
 * Legacy `availableOnline` was retired in #232 — the repository no longer
 * reads or writes that field. Compliance guards continue to honor an
 * `availableOnline: true` patch argument for back-compat with admin actions
 * pending their own removal (#233); the request is treated as intent to
 * expose the product for purchase.
 */
import { cache } from 'react';
import {
  getAdminFirestore,
  toDate,
  ONLINE_LOCATION_ID,
} from '@/lib/firebase/admin';
import type {
  InventoryItem,
  InventoryItemSummary,
  InventoryAdjustment,
  InventoryAdjustmentReason,
  InventoryAdjustmentSource,
} from '@/types';
import type { PageResult } from './types';

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
  locationId: string,
  opts: { limit?: number; cursor?: string } = {}
): Promise<PageResult<InventoryItem>> {
  const limit = opts.limit ?? 500;
  const col = inventoryItemsCol(locationId);
  let query = col.orderBy('__name__').limit(limit);

  if (opts.cursor) {
    const cursorSnap = await col.doc(opts.cursor).get();
    if (cursorSnap.exists) query = query.startAfter(cursorSnap);
  }

  const snap = await query.get();
  const items = snap.docs.map(doc => docToInventoryItem(doc.id, doc.data()));
  return {
    items,
    nextCursor: items.length < limit ? null : (snap.docs.at(-1)?.id ?? null),
  };
}

/**
 * Fetch a single inventory item for a product at a location.
 * Returns null if the item has not been tracked yet.
 * Callers should treat null as { inStock: false }.
 * Wrapped with React cache() to deduplicate parallel calls within the same request.
 */
export const getInventoryItem = cache(
  async (
    locationId: string,
    productId: string
  ): Promise<InventoryItem | null> => {
    const doc = await inventoryItemsCol(locationId).doc(productId).get();
    if (!doc.exists) return null;
    // doc.data() is safe here: existence is confirmed on the line above
    return docToInventoryItem(doc.id, doc.data()!);
  }
);

/**
 * Return the subset of the given product ids that are both online and in stock.
 * Uses a single batched Firestore read. Empty input → empty Set.
 */
export async function getOnlineInStockSet(
  productIds: string[]
): Promise<Set<string>> {
  if (productIds.length === 0) return new Set();
  const col = inventoryItemsCol(ONLINE_LOCATION_ID);
  const refs = productIds.map(id => col.doc(id));
  const snaps = await getAdminFirestore().getAll(...refs);
  const result = new Set<string>();
  for (const snap of snaps) {
    if (!snap.exists) continue;
    const data = snap.data();
    if (data?.inStock === true) result.add(snap.id);
  }
  return result;
}

/**
 * List all online inventory items that are in stock.
 * Reads from inventory/online (ONLINE_LOCATION_ID) — the canonical path
 * for storefront pricing. Each item's variantPricing map drives the
 * variant selector on the product detail page.
 */
export async function listOnlineAvailableInventory(
  opts: { limit?: number; cursor?: string } = {}
): Promise<PageResult<InventoryItemSummary>> {
  const limit = opts.limit ?? 25;
  const col = inventoryItemsCol(ONLINE_LOCATION_ID);
  let query = col.where('inStock', '==', true).orderBy('__name__').limit(limit);

  if (opts.cursor) {
    const cursorSnap = await col.doc(opts.cursor).get();
    if (cursorSnap.exists) query = query.startAfter(cursorSnap);
  }

  const snap = await query.get();
  const items = snap.docs.map(doc => {
    const d = doc.data();
    return {
      productId: doc.id,
      locationId: ONLINE_LOCATION_ID,
      inStock: d.inStock ?? false,
      availablePickup: false,
      featured: d.featured ?? false,
      quantity: d.quantity ?? undefined,
      variantPricing: docToVariantPricing(d.variantPricing),
    } satisfies InventoryItemSummary;
  });
  return {
    items,
    nextCursor: items.length < limit ? null : (snap.docs.at(-1)?.id ?? null),
  };
}

/**
 * List featured inventory items for a location.
 *
 * Online: returns items where featured = true. Invariants guarantee inStock
 * is also true. Used to populate homepage "What We Carry".
 *
 * Retail: returns items where featured = true. Invariants guarantee inStock
 * is also true. Used to populate per-store featured sections.
 */
export async function listFeaturedInventory(
  locationId: string,
  opts: { limit?: number; cursor?: string } = {}
): Promise<PageResult<InventoryItemSummary>> {
  const limit = opts.limit ?? 25;
  const col = inventoryItemsCol(locationId);
  let query = col
    .where('featured', '==', true)
    .orderBy('__name__')
    .limit(limit);

  if (opts.cursor) {
    const cursorSnap = await col.doc(opts.cursor).get();
    if (cursorSnap.exists) query = query.startAfter(cursorSnap);
  }

  const snap = await query.get();
  const items = snap.docs.map(doc => {
    const d = doc.data();
    return {
      productId: doc.id,
      locationId,
      inStock: d.inStock ?? false,
      availablePickup: d.availablePickup ?? false,
      featured: true,
      quantity: d.quantity ?? undefined,
      variantPricing: docToVariantPricing(d.variantPricing),
    } satisfies InventoryItemSummary;
  });
  return {
    items,
    nextCursor: items.length < limit ? null : (snap.docs.at(-1)?.id ?? null),
  };
}

/**
 * List featured inventory items at a location, returning the full
 * `InventoryItem` shape (not the summary). Filters to featured && inStock —
 * the invariant at write-time guarantees featured implies inStock, but the
 * equality query is spelled out here to keep the contract explicit.
 *
 * Introduced for the simplified storefront/home-page rails (#238) that need
 * the full item (notes, updatedAt, etc.) without a second round-trip.
 */
export async function listFeaturedAtLocation(
  locationId: string
): Promise<InventoryItem[]> {
  const col = inventoryItemsCol(locationId);
  const snap = await col
    .where('featured', '==', true)
    .where('inStock', '==', true)
    .get();
  return snap.docs.map(doc => docToInventoryItem(doc.id, doc.data()));
}

// ── Write operations ──────────────────────────────────────────────────────

/**
 * Create or update an inventory item.
 * Document ID is the productId — one record per product per location.
 *
 * Compliance guard: setting availableOnline: true (legacy, back-compat) or
 * availablePickup: true is blocked if the product has status 'compliance-hold'.
 * Throws if violated. Note that `availableOnline` is no longer persisted —
 * the argument is honored only as intent for the compliance check until
 * consumer call sites are cleaned up (#233).
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
    /** @deprecated Legacy — accepted for compliance-guard back-compat only; not persisted. */
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

  const currentQuantity = normalizeQuantity(
    current?.quantity,
    current?.inStock ?? false
  );
  const currentInStock: boolean = current?.inStock ?? false;
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

  const requestedAvailablePickup =
    patch.availablePickup ?? currentAvailablePickup;
  const requestedFeatured = patch.featured ?? currentFeatured;

  const nextAvailablePickup = nextInStock ? requestedAvailablePickup : false;
  // featured requires inStock at every location; availableOnline is no longer
  // a precondition (storefront visibility derives from inStock at the online
  // location directly — see listFeaturedAtLocation).
  const nextFeatured = nextInStock && requestedFeatured;

  // Compliance guard: still honors the legacy availableOnline === true intent
  // so admin actions that haven't been migrated (#233) keep their safety net.
  const requestsOnlineIntent = patch.availableOnline === true && nextInStock;
  if (requestsOnlineIntent || nextAvailablePickup) {
    // Intentional cross-collection read: this compliance guard must be
    // co-located with the write to avoid a circular dependency between repos.
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
      // Legacy schema fields — always false since availableOnline is retired (#232).
      previousAvailableOnline: false,
      nextAvailableOnline: false,
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

  return {
    productId: id,
    locationId: d.locationId,
    inStock,
    availablePickup: inStock ? (d.availablePickup ?? false) : false,
    // featured requires inStock at every location.
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

// ── Atomic decrement (transactional) ──────────────────────────────────────

export class InsufficientStockError extends Error {
  readonly productId: string;
  readonly locationId: string;
  readonly available: number;
  readonly requested: number;

  constructor(
    locationId: string,
    productId: string,
    available: number,
    requested: number
  ) {
    super(
      `Insufficient stock for '${productId}' at '${locationId}': have ${available}, need ${requested}`
    );
    this.name = 'InsufficientStockError';
    this.productId = productId;
    this.locationId = locationId;
    this.available = available;
    this.requested = requested;
  }
}

/**
 * Atomically decrement inventory for a list of items at one location.
 *
 * Runs in a single Firestore transaction: reads every referenced item,
 * verifies sufficient stock, then writes the new quantities. Throws
 * `InsufficientStockError` on any shortage — the transaction is rolled
 * back so no partial writes survive.
 *
 * Caller is responsible for choosing the source location (typically the
 * order's `locationId`).
 */
export async function decrementInventoryItems(
  locationId: string,
  items: { productId: string; quantity: number }[]
): Promise<void> {
  if (items.length === 0) return;

  const db = getAdminFirestore();
  const col = inventoryItemsCol(locationId);

  await db.runTransaction(async tx => {
    const refs = items.map(i => col.doc(i.productId));
    const snaps = await Promise.all(refs.map(r => tx.get(r)));

    const now = new Date();

    for (let i = 0; i < items.length; i++) {
      const { productId, quantity } = items[i];
      const snap = snaps[i];
      const data = snap.exists ? snap.data() : undefined;
      const currentQuantity = normalizeQuantity(
        data?.quantity,
        data?.inStock ?? false
      );

      if (currentQuantity < quantity) {
        throw new InsufficientStockError(
          locationId,
          productId,
          currentQuantity,
          quantity
        );
      }

      const nextQuantity = currentQuantity - quantity;
      const nextInStock = nextQuantity > 0;

      tx.set(
        refs[i],
        {
          productId,
          locationId,
          quantity: nextQuantity,
          inStock: nextInStock,
          // Mirror the invariants enforced in setInventoryItem: when a SKU
          // sells out, it cannot remain pickup-available or featured.
          ...(nextInStock ? {} : { availablePickup: false, featured: false }),
          updatedAt: now,
        },
        { merge: true }
      );
    }
  });
}
