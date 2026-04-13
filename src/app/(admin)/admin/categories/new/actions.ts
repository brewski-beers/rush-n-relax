'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import { getCategoryBySlug, upsertCategory } from '@/lib/repositories';

export async function createCategory(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  await requireRole('staff');

  const slug = formData.get('slug')?.toString().trim().toLowerCase();
  const label = formData.get('label')?.toString().trim();
  const description = formData.get('description')?.toString().trim();
  const orderRaw = formData.get('order')?.toString().trim();
  const isActive = formData.get('isActive') === 'true';

  if (!slug || !label || !description || !orderRaw) {
    return { error: 'All required fields must be filled.' };
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return {
      error: 'Slug must be lowercase letters, numbers, and hyphens only.',
    };
  }

  const order = parseInt(orderRaw, 10);
  if (!Number.isFinite(order) || order < 1) {
    return { error: 'Order must be a positive integer.' };
  }

  const existing = await getCategoryBySlug(slug);
  if (existing) {
    return { error: `A category with slug "${slug}" already exists.` };
  }

  await upsertCategory({ slug, label, description, order, isActive });

  revalidatePath('/admin/categories');
  revalidatePath('/products');

  redirect('/admin/categories');
}
