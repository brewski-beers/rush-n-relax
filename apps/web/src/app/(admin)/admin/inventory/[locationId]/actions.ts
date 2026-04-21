'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/admin-auth';
import { getInventoryItem, setInventoryItem } from '@/lib/repositories';
import type { InventoryItem } from '@/types/inventory';

/**
 * Result returned by {@link updateInventoryItem}.
 *
 * `blocked` describes availability flags that the caller asked to enable
 * but which the inventory cascade silently forced to `false` (e.g. because
 * quantity is 0 → inStock=false → availableOnline/availablePickup=false).
 * Consumers should surface an inline toast when any blocked flag is set;
 * the underlying patch is NOT auto-restored.
 */
export interface UpdateInventoryItemResult {
  blocked?: {
    availableOnline?: true;
    availablePickup?: true;
  };
}

export async function updateInventoryItem(
  locationId: string,
  productId: string,
  patch: {
    inStock?: boolean;
    quantity?: number;
    availableOnline?: boolean;
    availablePickup?: boolean;
    featured?: boolean;
  }
): Promise<UpdateInventoryItemResult> {
  const actor = await requireRole('owner');

  const reason =
    patch.quantity !== undefined
      ? 'manual-count'
      : patch.inStock !== undefined
        ? 'toggle-stock'
        : patch.featured !== undefined
          ? 'toggle-featured'
          : patch.availablePickup !== undefined
            ? 'toggle-pickup'
            : 'toggle-online';

  await setInventoryItem(
    locationId,
    productId,
    {
      ...(patch.inStock !== undefined && { inStock: patch.inStock }),
      ...(patch.quantity !== undefined && { quantity: patch.quantity }),
      ...(patch.availableOnline !== undefined && {
        availableOnline: patch.availableOnline,
      }),
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

  // Detect invariant cascade: if the caller tried to enable an availability
  // flag, re-read the item and see whether the cascade forced it back to false.
  const result: UpdateInventoryItemResult = {};
  const wantsAvailableOnline = patch.availableOnline === true;
  const wantsAvailablePickup = patch.availablePickup === true;

  if (wantsAvailableOnline || wantsAvailablePickup) {
    const saved = await getInventoryItem(locationId, productId);
    if (saved) {
      const blocked: UpdateInventoryItemResult['blocked'] = {};
      if (wantsAvailableOnline && saved.availableOnline === false) {
        blocked.availableOnline = true;
      }
      if (wantsAvailablePickup && saved.availablePickup === false) {
        blocked.availablePickup = true;
      }
      if (blocked.availableOnline || blocked.availablePickup) {
        result.blocked = blocked;
      }
    }
  }

  revalidatePath(`/admin/inventory/${locationId}`);
  revalidatePath('/admin/inventory');
  revalidatePath('/');
  revalidatePath('/products');

  return result;
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
