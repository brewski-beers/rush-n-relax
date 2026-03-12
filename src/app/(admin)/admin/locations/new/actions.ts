'use server';

import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import { upsertLocation, getLocationBySlug } from '@/lib/repositories';

export async function createLocation(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  await requireRole('superadmin');

  const slug = formData.get('slug')?.toString().trim().toLowerCase();
  const name = formData.get('name')?.toString().trim();
  const address = formData.get('address')?.toString().trim();
  const city = formData.get('city')?.toString().trim();
  const state = formData.get('state')?.toString().trim();
  const zip = formData.get('zip')?.toString().trim();
  const phone = formData.get('phone')?.toString().trim();
  const hours = formData.get('hours')?.toString().trim();
  const description = formData.get('description')?.toString().trim();
  const placeId = formData.get('placeId')?.toString().trim();

  if (
    !slug ||
    !name ||
    !address ||
    !city ||
    !state ||
    !zip ||
    !phone ||
    !hours ||
    !description ||
    !placeId
  ) {
    return { error: 'All fields are required.' };
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return {
      error: 'Slug must be lowercase letters, numbers, and hyphens only.',
    };
  }

  const existing = await getLocationBySlug(slug);
  if (existing)
    return { error: `A location with slug "${slug}" already exists.` };

  await upsertLocation({
    slug,
    name,
    address,
    city,
    state,
    zip,
    phone,
    hours,
    description,
    placeId,
  });

  redirect('/admin/locations');
}
