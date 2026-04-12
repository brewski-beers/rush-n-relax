'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/admin-auth';
import { setVendorActive } from '@/lib/repositories';

export async function toggleVendorActive(
  slug: string,
  currentIsActive: boolean
): Promise<void> {
  await requireRole('owner');
  await setVendorActive(slug, !currentIsActive);
  revalidatePath('/admin/vendors');
}
