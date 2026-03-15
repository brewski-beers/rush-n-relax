'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/admin-auth';
import { setCategoryStatus } from '@/lib/repositories';

export async function toggleCategoryStatus(
  slug: string,
  currentIsActive: boolean
): Promise<void> {
  await requireRole('owner');
  await setCategoryStatus(slug, !currentIsActive);
  revalidatePath('/admin/categories');
  revalidatePath('/products');
}
