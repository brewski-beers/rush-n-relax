'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import { getVendorBySlug, upsertVendor } from '@/lib/repositories';

export async function updateVendor(
  slug: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  await requireRole('owner');

  const existing = await getVendorBySlug(slug);
  if (!existing) return { error: 'Vendor not found.' };

  const name = formData.get('name')?.toString().trim();
  const descriptionSource = formData.get('descriptionSource')?.toString() as
    | 'leafly'
    | 'custom'
    | 'vendor-provided'
    | undefined;
  const website = formData.get('website')?.toString().trim() || undefined;
  const notes = formData.get('notes')?.toString().trim() || undefined;
  const isActive = formData.get('isActive') === 'true';

  if (!name || !descriptionSource) {
    return { error: 'Name and description source are required.' };
  }

  if (!['leafly', 'custom', 'vendor-provided'].includes(descriptionSource)) {
    return { error: 'Invalid description source.' };
  }

  try {
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
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
    return { error: 'Failed to save. Please try again.' };
  }
}
