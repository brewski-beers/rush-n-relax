'use server';

import { cookies } from 'next/headers';
import { getAdminAuth } from '@/lib/firebase/admin';
import { setInventoryItem } from '@/lib/repositories';

export async function updateInventoryItem(
  locationId: string,
  productId: string,
  patch: { inStock?: boolean; availableOnline?: boolean }
): Promise<void> {
  // Verify the caller holds a valid admin session — Server Actions are
  // publicly reachable HTTP endpoints; middleware only checks cookie presence.
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) throw new Error('Unauthorized');
  await getAdminAuth().verifySessionCookie(
    sessionCookie,
    true /* checkRevoked */
  );

  await setInventoryItem(locationId, productId, {
    inStock: patch.inStock ?? false,
    availableOnline: patch.availableOnline ?? false,
    updatedBy: 'admin',
  });
}
