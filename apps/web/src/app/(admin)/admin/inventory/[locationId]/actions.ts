'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/admin-auth';
import {
  getProductBySlug,
  setInventoryItem,
  setVariantLocation,
} from '@/lib/repositories';
import type { InventoryItem } from '@/types/inventory';
import type { ProductVariantLocation } from '@/types/product';

const DEFAULT_VARIANT_ID = 'default';

/**
 * Result returned by {@link updateInventoryItem}.
 *
 * Success returns the saved item snapshot (derived from variantSpecs).
 * Failure returns an error string (400-style client error — e.g. invariant
 * violation).
 *
 * @deprecated `blocked` is a transitional compat field retained so the
 * existing admin UI (InventoryTable) keeps compiling while issue #234
 * redesigns the consumer. It is always an empty object and will be
 * removed in #234.
 */
export type UpdateInventoryItemResult =
  | { ok: true; data: InventoryItem; blocked?: Record<string, never> }
  | { ok: false; error: string; blocked?: Record<string, never> };

/**
 * Update the per-location stock entry for a product's `default` variant.
 *
 * Issue #358: writes go through `setVariantLocation` so they land in
 * `products/{slug}.variantSpecs.default.locations[locationId]` (the new
 * shape introduced by #305/#306). The legacy
 * `inventory/{locationId}/items/{productId}` collection is being retired.
 *
 * Multi-variant editing is out of scope for this ticket — the admin UI
 * still operates on a single implicit `default` variant.
 */
export async function updateInventoryItem(
  locationId: string,
  productId: string,
  patch: {
    inStock?: boolean;
    quantity?: number;
    availablePickup?: boolean;
    featured?: boolean;
  }
): Promise<UpdateInventoryItemResult> {
  const actor = await requireRole('owner');

  const product = await getProductBySlug(productId);
  if (!product) {
    return { ok: false, error: `Product '${productId}' not found.` };
  }

  const existing =
    product.variantSpecs?.[DEFAULT_VARIANT_ID]?.locations?.[locationId];

  // Resolve qty: explicit `quantity` wins; otherwise `inStock` toggles
  // map to qty=max(existing,1) on or qty=0 off.
  const existingQty = existing?.qty ?? 0;
  const nextQty =
    patch.quantity !== undefined
      ? Math.max(0, Math.floor(patch.quantity))
      : patch.inStock === true
        ? Math.max(existingQty, 1)
        : patch.inStock === false
          ? 0
          : existingQty;

  const willBeInStock = nextQty > 0;

  // Invariant: featured=true requires the resulting state to be inStock.
  // Reject eagerly rather than silently writing a broken state.
  if (patch.featured === true && !willBeInStock) {
    return {
      ok: false,
      error: 'Cannot feature an item that is not in stock.',
    };
  }

  // Compose final ProductVariantLocation. Preserve existing price /
  // compareAtPrice / availablePickup / featured unless the patch overrides.
  // When qty=0 (out of stock), force availablePickup and featured false to
  // keep the index recompute consistent.
  const nextAvailablePickup = !willBeInStock
    ? false
    : (patch.availablePickup ?? existing?.availablePickup);
  const nextFeatured = !willBeInStock
    ? false
    : (patch.featured ?? existing?.featured);

  const next: ProductVariantLocation = {
    qty: nextQty,
    price: existing?.price ?? 0,
    ...(existing?.compareAtPrice !== undefined && {
      compareAtPrice: existing.compareAtPrice,
    }),
    ...(nextAvailablePickup !== undefined && {
      availablePickup: nextAvailablePickup,
    }),
    ...(nextFeatured !== undefined && { featured: nextFeatured }),
  };

  const reason =
    patch.quantity !== undefined
      ? 'manual-count'
      : patch.inStock !== undefined
        ? 'toggle-stock'
        : patch.featured !== undefined
          ? 'toggle-featured'
          : 'toggle-pickup';

  try {
    await setVariantLocation(productId, DEFAULT_VARIANT_ID, locationId, next, {
      source: 'admin',
      actor: actor.email,
      reason,
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to update inventory.',
    };
  }

  revalidatePath(`/admin/inventory/${locationId}`);
  revalidatePath('/admin/inventory');
  revalidatePath('/');
  revalidatePath('/products');

  // Synthesize the legacy InventoryItem shape so the admin UI keeps
  // rendering until #234 redesigns the consumer.
  const saved: InventoryItem = {
    productId,
    locationId,
    inStock: willBeInStock,
    availableOnline: willBeInStock,
    availablePickup: nextAvailablePickup ?? false,
    featured: nextFeatured ?? false,
    quantity: nextQty,
    updatedAt: new Date(),
  };

  return { ok: true, data: saved, blocked: {} };
}

/**
 * Update per-variant pricing on a location's inventory item.
 *
 * NOTE (#358): Still routes through the legacy `setInventoryItem` path
 * because the multi-variant editor UI (and the matching variantSpecs
 * write surface for non-default variants) is out of scope for this
 * ticket. Migration tracked alongside the multi-variant editor work.
 */
export async function updateVariantPricing(
  locationId: string,
  productId: string,
  variantPricing: NonNullable<InventoryItem['variantPricing']>
): Promise<void> {
  const actor = await requireRole('owner');

  await setInventoryItem(
    locationId,
    productId,
    { variantPricing, updatedBy: actor.email },
    {
      reason: 'price-update',
      source: 'admin-ui',
      updatedBy: actor.email,
    }
  );

  revalidatePath(`/admin/inventory/${locationId}`);
  revalidatePath('/admin/inventory');
  revalidatePath('/products');
}
