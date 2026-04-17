'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import { upsertVendor, getVendorBySlug } from '@/lib/repositories';

export async function updateVendor(
  slug: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  await requireRole('owner');

  const existing = await getVendorBySlug(slug);
  if (!existing) return { error: 'Vendor not found.' };

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

  if (!name) {
    return { error: 'Name is required.' };
  }

  try {
    await upsertVendor({
      slug: existing.slug,
      name,
      website,
      logoUrl,
      description,
      categories,
      isActive: existing.isActive,
    });

    revalidatePath('/admin/vendors');
    redirect('/admin/vendors');
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
    return { error: 'Failed to save. Please try again.' };
  }
}
