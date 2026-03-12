'use server';

import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import { upsertLocation, getLocationBySlug } from '@/lib/repositories';

export async function updateLocation(
  slug: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  await requireRole('superadmin');

  const existing = await getLocationBySlug(slug);
  if (!existing) return { error: 'Location not found.' };

  const name = formData.get('name')?.toString().trim();
  const address = formData.get('address')?.toString().trim();
  const city = formData.get('city')?.toString().trim();
  const state = formData.get('state')?.toString().trim();
  const zip = formData.get('zip')?.toString().trim();
  const phone = formData.get('phone')?.toString().trim();
  const hours = formData.get('hours')?.toString().trim();
  const description = formData.get('description')?.toString().trim();

  if (
    !name ||
    !address ||
    !city ||
    !state ||
    !zip ||
    !phone ||
    !hours ||
    !description
  ) {
    return { error: 'All fields are required.' };
  }

  await upsertLocation({
    ...existing,
    name,
    address,
    city,
    state,
    zip,
    phone,
    hours,
    description,
  });

  redirect(`/admin/locations`);
}
