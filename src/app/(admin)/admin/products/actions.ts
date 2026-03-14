'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/admin-auth';
import { setProductStatus } from '@/lib/repositories';

export async function archiveProduct(slug: string): Promise<void> {
  await requireRole('owner');
  await setProductStatus(slug, 'archived');
  revalidatePath('/admin/products');
  revalidatePath('/products');
  revalidatePath(`/products/${slug}`);
}

export async function restoreProduct(slug: string): Promise<void> {
  await requireRole('owner');
  await setProductStatus(slug, 'active');
  revalidatePath('/admin/products');
  revalidatePath('/products');
  revalidatePath(`/products/${slug}`);
}
