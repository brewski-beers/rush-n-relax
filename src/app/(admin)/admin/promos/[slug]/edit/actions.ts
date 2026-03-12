'use server';

import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import { upsertPromo, getPromoBySlug } from '@/lib/repositories';

export async function updatePromo(
  slug: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  await requireRole('superadmin');

  const existing = await getPromoBySlug(slug);
  if (!existing) return { error: 'Promo not found.' };

  const name = formData.get('name')?.toString().trim();
  const tagline = formData.get('tagline')?.toString().trim();
  const description = formData.get('description')?.toString().trim();
  const details = formData.get('details')?.toString().trim();
  const cta = formData.get('cta')?.toString().trim();
  const ctaPath = formData.get('ctaPath')?.toString().trim();
  const locationSlug =
    formData.get('locationSlug')?.toString().trim() || undefined;
  const active = formData.get('active') === 'true';

  if (!name || !tagline || !description || !details || !cta || !ctaPath) {
    return { error: 'All required fields must be filled.' };
  }

  if (!ctaPath.startsWith('/')) {
    return { error: 'CTA Path must be an internal path starting with /.' };
  }

  await upsertPromo({
    ...existing,
    name,
    tagline,
    description,
    details,
    cta,
    ctaPath,
    locationSlug,
    active,
  });

  redirect(`/admin/promos`);
}
