'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import { upsertProduct, getProductBySlug } from '@/lib/repositories';
import type { ProductCategory, ProductStatus } from '@/types';

const VALID_CATEGORIES: ProductCategory[] = [
  'flower',
  'concentrates',
  'drinks',
  'edibles',
  'vapes',
];
// compliance-hold is system-managed — admins cannot set it directly
const SETTABLE_STATUSES: ProductStatus[] = [
  'active',
  'pending-reformulation',
  'archived',
];

export async function updateProduct(
  slug: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  await requireRole('owner');

  const existing = await getProductBySlug(slug);
  if (!existing) return { error: 'Product not found.' };

  const name = formData.get('name')?.toString().trim();
  const category = formData.get('category')?.toString() as ProductCategory;
  const description = formData.get('description')?.toString().trim();
  const details = formData.get('details')?.toString().trim();
  const status = formData.get('status')?.toString() as ProductStatus;
  const featured = formData.get('featured') === 'true';
  const federalDeadlineRisk = formData.get('federalDeadlineRisk') === 'true';
  const availableAt = formData.getAll('availableAt').map(v => v.toString());

  if (!name || !category || !description || !details || !status) {
    return { error: 'All required fields must be filled.' };
  }

  if (!VALID_CATEGORIES.includes(category)) {
    return { error: 'Invalid category.' };
  }

  if (!SETTABLE_STATUSES.includes(status)) {
    return { error: 'Cannot set that status directly.' };
  }

  const payload = {
    slug: existing.slug,
    name,
    category,
    description,
    details,
    image: existing.image,
    status,
    featured,
    federalDeadlineRisk,
    availableAt,
  };

  try {
    await upsertProduct({
      ...payload,
      ...(existing.coaUrl ? { coaUrl: existing.coaUrl } : {}),
    });

    revalidatePath('/admin/products');
    revalidatePath('/products');
    revalidatePath(`/products/${existing.slug}`);

    redirect('/admin/products');
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
    return { error: 'Failed to save. Please try again.' };
  }
}
