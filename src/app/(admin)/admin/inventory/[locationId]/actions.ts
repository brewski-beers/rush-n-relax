'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/admin-auth';
import { setInventoryItem } from '@/lib/repositories';

export async function updateInventoryItem(
  locationId: string,
  productId: string,
  patch: { inStock?: boolean; quantity?: number; availableOnline?: boolean }
): Promise<void> {
  const actor = await requireRole('superadmin');

  const reason =
    patch.quantity !== undefined
      ? 'manual-count'
      : patch.inStock !== undefined
        ? 'toggle-stock'
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
    },
    {
      reason,
      source: 'admin-ui',
      updatedBy: actor.email,
    }
  );

  revalidatePath(`/admin/inventory/${locationId}`);
  revalidatePath('/admin/inventory');
}
