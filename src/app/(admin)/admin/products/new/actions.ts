'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import {
  upsertProduct,
  getProductBySlug,
  listActiveCategories,
} from '@/lib/repositories';

export async function createProduct(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  await requireRole('owner');

  const slug = formData.get('slug')?.toString().trim().toLowerCase();
  const name = formData.get('name')?.toString().trim();
  const category = formData.get('category')?.toString();
  const description = formData.get('description')?.toString().trim();
  const details = formData.get('details')?.toString().trim();
  const federalDeadlineRisk = formData.get('federalDeadlineRisk') === 'true';
  const availableAt = formData.getAll('availableAt').map(v => v.toString());

  if (!slug || !name || !category || !description || !details) {
    return { error: 'All required fields must be filled.' };
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return {
      error: 'Slug must be lowercase letters, numbers, and hyphens only.',
    };
  }

  const activeCategories = await listActiveCategories();
  if (!activeCategories.some(c => c.slug === category)) {
    return { error: 'Invalid category.' };
  }

  const existing = await getProductBySlug(slug);
  if (existing)
    return { error: `A product with slug "${slug}" already exists.` };

  await upsertProduct({
    slug,
    name,
    category,
    description,
    details,
    federalDeadlineRisk,
    availableAt,
    status: 'active',
  });

  revalidatePath('/admin/products');
  revalidatePath('/products');
  revalidatePath(`/products/${slug}`);

  redirect('/admin/products');
}
