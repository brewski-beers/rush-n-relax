'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import { getVendorBySlug, upsertVendor } from '@/lib/repositories';

export async function createVendor(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  await requireRole('owner');

  const slug = formData.get('slug')?.toString().trim().toLowerCase();
  const name = formData.get('name')?.toString().trim();
  const descriptionSource = formData.get('descriptionSource')?.toString() as
    | 'leafly'
    | 'custom'
    | 'vendor-provided'
    | undefined;
  const website = formData.get('website')?.toString().trim() || undefined;
  const notes = formData.get('notes')?.toString().trim() || undefined;
  const isActive = formData.get('isActive') === 'true';

  if (!slug || !name || !descriptionSource) {
    return { error: 'Slug, name, and description source are required.' };
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return {
      error: 'Slug must be lowercase letters, numbers, and hyphens only.',
    };
  }

  if (!['leafly', 'custom', 'vendor-provided'].includes(descriptionSource)) {
    return { error: 'Invalid description source.' };
  }

  const existing = await getVendorBySlug(slug);
  if (existing) {
    return { error: `A vendor with slug "${slug}" already exists.` };
  }

  await upsertVendor({
    slug,
    name,
    descriptionSource,
    website,
    notes,
    isActive,
  });

  revalidatePath('/admin/vendors');

  redirect('/admin/vendors');
}
