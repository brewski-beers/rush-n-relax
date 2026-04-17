'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import { upsertVendor, getVendorBySlug } from '@/lib/repositories';

export async function createVendor(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  await requireRole('owner');

  const slug = formData.get('slug')?.toString().trim().toLowerCase();
  const name = formData.get('name')?.toString().trim();
  const website = formData.get('website')?.toString().trim() || undefined;
  const logoUrl = formData.get('logoUrl')?.toString().trim() || undefined;
  const description =
    formData.get('description')?.toString().trim() || undefined;
  const categoriesRaw = formData.get('categories')?.toString() ?? '';
  const categories = categoriesRaw
    ? categoriesRaw
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    : [];

  if (!slug || !name) {
    return { error: 'Slug and name are required.' };
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return {
      error: 'Slug must be lowercase letters, numbers, and hyphens only.',
    };
  }

  const existing = await getVendorBySlug(slug);
  if (existing)
    return { error: `A vendor with slug "${slug}" already exists.` };

  await upsertVendor({
    slug,
    name,
    website,
    logoUrl,
    description,
    categories,
    isActive: true,
  });

  revalidatePath('/admin/vendors');
  redirect('/admin/vendors');
}
