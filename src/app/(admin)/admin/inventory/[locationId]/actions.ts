'use server';

import { setInventoryItem } from '@/lib/repositories';

export async function updateInventoryItem(
  locationId: string,
  productId: string,
  patch: { inStock?: boolean; availableOnline?: boolean }
): Promise<void> {
  await setInventoryItem(locationId, productId, {
    inStock: patch.inStock ?? false,
    availableOnline: patch.availableOnline ?? false,
    updatedBy: 'admin',
  });
}
