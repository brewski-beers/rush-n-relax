'use server';

import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import { upsertPromo, getPromoBySlug } from '@/lib/repositories';

export async function createPromo(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  await requireRole('owner');

  const slug = formData.get('slug')?.toString().trim().toLowerCase();
  const name = formData.get('name')?.toString().trim();
  const tagline = formData.get('tagline')?.toString().trim();
  const description = formData.get('description')?.toString().trim();
  const details = formData.get('details')?.toString().trim();
  const cta = formData.get('cta')?.toString().trim();
  const ctaPath = formData.get('ctaPath')?.toString().trim();
  const locationSlug =
    formData.get('locationSlug')?.toString().trim() || undefined;
  const active = formData.get('active') === 'true';
  const startDate = formData.get('startDate')?.toString().trim() || undefined;
  const endDate = formData.get('endDate')?.toString().trim() || undefined;

  if (
    !slug ||
    !name ||
    !tagline ||
    !description ||
    !details ||
    !cta ||
    !ctaPath
  ) {
    return { error: 'All required fields must be filled.' };
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return {
      error: 'Slug must be lowercase letters, numbers, and hyphens only.',
    };
  }

  if (!ctaPath.startsWith('/')) {
    return { error: 'CTA Path must be an internal path starting with /.' };
  }

  const existing = await getPromoBySlug(slug);
  if (existing) return { error: `A promo with slug "${slug}" already exists.` };

  await upsertPromo({
    slug,
    name,
    tagline,
    description,
    details,
    cta,
    ctaPath,
    locationSlug,
    active,
    startDate,
    endDate,
  });

  redirect('/admin/promos');
}
