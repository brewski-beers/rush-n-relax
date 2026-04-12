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
  const descriptionSource = formData
    .get('descriptionSource')
    ?.toString() as DescriptionSource;
  const notes = formData.get('notes')?.toString().trim() || undefined;

  if (!name || !descriptionSource) {
    return { error: 'Name and description source are required.' };
  }

  if (!VALID_SOURCES.includes(descriptionSource)) {
    return { error: 'Invalid description source.' };
  }

  try {
    await upsertVendor({
      slug: existing.slug,
      name,
      website,
      logoUrl,
      descriptionSource,
      notes,
      isActive: existing.isActive,
    });

    revalidatePath('/admin/vendors');
    redirect('/admin/vendors');
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
    return { error: 'Failed to save. Please try again.' };
  }
}
