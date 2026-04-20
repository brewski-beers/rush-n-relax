'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/admin-auth';
import { setCategoryStatus, reorderCategories } from '@/lib/repositories';

export async function toggleCategoryStatus(
  slug: string,
  currentIsActive: boolean
): Promise<void> {
  await requireRole('staff');
  await setCategoryStatus(slug, !currentIsActive);
  revalidatePath('/admin/categories');
  revalidatePath('/products');
}

export async function reorderCategoriesAction(
  orderedSlugs: string[]
): Promise<void> {
  await requireRole('staff');
  await reorderCategories(orderedSlugs);
  revalidatePath('/admin/categories');
  revalidatePath('/products');
}
