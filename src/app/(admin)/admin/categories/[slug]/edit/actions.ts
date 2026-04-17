'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import { getCategoryBySlug, upsertCategory } from '@/lib/repositories';

export async function updateCategory(
  slug: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  await requireRole('staff');

  const existing = await getCategoryBySlug(slug);
  if (!existing) return { error: 'Category not found.' };

  const label = formData.get('label')?.toString().trim();
  const description = formData.get('description')?.toString().trim();
  const orderRaw = formData.get('order')?.toString().trim();
  const isActive = formData.get('isActive') === 'true';
  const requiresCannabisProfile =
    formData.get('requiresCannabisProfile') === 'true';
  const requiresNutritionFacts =
    formData.get('requiresNutritionFacts') === 'true';
  const requiresCOA = formData.get('requiresCOA') === 'true';

  if (!label || !description || !orderRaw) {
    return { error: 'All required fields must be filled.' };
  }

  const order = parseInt(orderRaw, 10);
  if (!Number.isFinite(order) || order < 1) {
    return { error: 'Order must be a positive integer.' };
  }

  try {
    await upsertCategory({
      slug,
      label,
      description,
      order,
      isActive,
      requiresCannabisProfile,
      requiresNutritionFacts,
      requiresCOA,
    });

    revalidatePath('/admin/categories');
    revalidatePath('/products');

    redirect('/admin/categories');
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
    return { error: 'Failed to save. Please try again.' };
  }
}
