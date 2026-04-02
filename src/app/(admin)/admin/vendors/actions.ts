'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/admin-auth';
import { setVendorActive } from '@/lib/repositories';

export async function deactivateVendor(slug: string): Promise<void> {
  await requireRole('owner');
  await setVendorActive(slug, false);
  revalidatePath('/admin/vendors');
}

export async function activateVendor(slug: string): Promise<void> {
  await requireRole('owner');
  await setVendorActive(slug, true);
  revalidatePath('/admin/vendors');
}
