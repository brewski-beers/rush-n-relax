'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/admin-auth';
import { getInventoryItem, setInventoryItem } from '@/lib/repositories';
import type { InventoryItem } from '@/types/inventory';

/**
 * Result returned by {@link updateInventoryItem}.
 *
 * Success returns the saved item. Failure returns an error string
 * (400-style client error — e.g. invariant violation).
 *
 * @deprecated `blocked` is a transitional compat field retained so the
 * existing admin UI (InventoryTable) keeps compiling while issue #234
 * redesigns the consumer. It is always an empty object and will be
 * removed in #234.
 */
export type UpdateInventoryItemResult =
  | { ok: true; data: InventoryItem; blocked?: Record<string, never> }
  | { ok: false; error: string; blocked?: Record<string, never> };

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

  // Invariant: featured=true requires inStock=true in the same patch
  // (or already-true on the saved doc). Reject eagerly rather than
  // silently writing a broken state.
  if (patch.featured === true && patch.inStock !== true) {
    const current =
      patch.inStock === false ? null : await getInventoryItem(locationId, productId);
    if (!current || current.inStock !== true) {
      return {
        ok: false,
        error: 'Cannot feature an item that is not in stock.',
      };
    }
  }

  const reason =
    patch.quantity !== undefined
      ? 'manual-count'
      : patch.inStock !== undefined
        ? 'toggle-stock'
        : patch.featured !== undefined
          ? 'toggle-featured'
          : 'toggle-pickup';

  await setInventoryItem(
    locationId,
    productId,
    {
      ...(patch.inStock !== undefined && { inStock: patch.inStock }),
      ...(patch.quantity !== undefined && { quantity: patch.quantity }),
      ...(patch.availablePickup !== undefined && {
        availablePickup: patch.availablePickup,
      }),
      ...(patch.featured !== undefined && { featured: patch.featured }),
    },
    {
      reason,
      source: 'admin-ui',
      updatedBy: actor.email,
    }
  );

  const saved = await getInventoryItem(locationId, productId);

  revalidatePath(`/admin/inventory/${locationId}`);
  revalidatePath('/admin/inventory');
  revalidatePath('/');
  revalidatePath('/products');

  if (!saved) {
    return {
      ok: false,
      error: 'Inventory item not found after write.',
    };
  }

  return { ok: true, data: saved, blocked: {} };
}

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
