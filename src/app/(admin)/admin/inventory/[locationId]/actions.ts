'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/admin-auth';
import { setInventoryItem } from '@/lib/repositories';

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
): Promise<void> {
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

  revalidatePath(`/admin/inventory/${locationId}`);
  revalidatePath('/admin/inventory');
  revalidatePath('/');
  revalidatePath('/products');
}
