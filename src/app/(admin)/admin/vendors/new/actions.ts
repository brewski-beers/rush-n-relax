'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import { upsertVendor, getVendorBySlug } from '@/lib/repositories';
import type { DescriptionSource } from '@/types';

const VALID_SOURCES: DescriptionSource[] = [
  'leafly',
  'custom',
  'vendor-provided',
];

export async function createVendor(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  await requireRole('owner');

  const slug = formData.get('slug')?.toString().trim().toLowerCase();
  const name = formData.get('name')?.toString().trim();
  const website = formData.get('website')?.toString().trim() || undefined;
  const logoUrl = formData.get('logoUrl')?.toString().trim() || undefined;
  const descriptionSource = formData
    .get('descriptionSource')
    ?.toString() as DescriptionSource;
  const notes = formData.get('notes')?.toString().trim() || undefined;

  if (!slug || !name || !descriptionSource) {
    return { error: 'Slug, name, and description source are required.' };
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return {
      error: 'Slug must be lowercase letters, numbers, and hyphens only.',
    };
  }

  if (!VALID_SOURCES.includes(descriptionSource)) {
    return { error: 'Invalid description source.' };
  }

  const existing = await getVendorBySlug(slug);
  if (existing)
    return { error: `A vendor with slug "${slug}" already exists.` };

  await upsertVendor({
    slug,
    name,
    website,
    logoUrl,
    descriptionSource,
    notes,
    isActive: true,
  });

  revalidatePath('/admin/vendors');
  redirect('/admin/vendors');
}
