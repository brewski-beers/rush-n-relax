'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import {
  upsertProduct,
  getProductBySlug,
  listActiveCategories,
} from '@/lib/repositories';
import type { ProductStatus, LabResults } from '@/types';

// compliance-hold is system-managed — admins cannot set it directly
const SETTABLE_STATUSES: ProductStatus[] = [
  'active',
  'pending-reformulation',
  'archived',
  'compliance-hold', // passthrough only — validated below
];

export async function updateProduct(
  slug: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  await requireRole('owner');

  const existing = await getProductBySlug(slug);
  if (!existing) return { error: 'Product not found.' };

  const name = formData.get('name')?.toString().trim();
  const category = formData.get('category')?.toString();
  const description = formData.get('description')?.toString().trim();
  const details = formData.get('details')?.toString().trim();
  const status = formData.get('status')?.toString() as ProductStatus;
  const federalDeadlineRisk = formData.get('federalDeadlineRisk') === 'true';
  const availableAt = formData.getAll('availableAt').map(v => v.toString());
  const vendorSlug = formData.get('vendorSlug')?.toString().trim() || undefined;
  const leaflyUrl = formData.get('leaflyUrl')?.toString().trim() || undefined;
  const coaUrl = formData.get('coaUrl')?.toString().trim() || undefined;

  if (!name || !category || !description || !details || !status) {
    return { error: 'All required fields must be filled.' };
  }

  const activeCategories = await listActiveCategories();
  if (!activeCategories.some(c => c.slug === category)) {
    return { error: 'Invalid category.' };
  }

  // compliance-hold can only pass through — cannot be set directly
  if (status !== 'compliance-hold' && !SETTABLE_STATUSES.includes(status)) {
    return { error: 'Cannot set that status directly.' };
  }
  if (status === 'compliance-hold' && existing.status !== 'compliance-hold') {
    return { error: 'Cannot set compliance-hold directly.' };
  }

  const featuredImagePath =
    formData.get('featuredImagePath')?.toString() || undefined;
  const galleryImagePaths = ([0, 1, 2, 3, 4] as const)
    .map(i => formData.get(`galleryImagePath_${i}`)?.toString() || undefined)
    .filter((p): p is string => p !== undefined);

  // Build optional lab results sub-object from wizard step 4 fields
  const thcRaw = formData.get('labThcPercent')?.toString();
  const cbdRaw = formData.get('labCbdPercent')?.toString();
  const terpenesRaw = formData.get('labTerpenes')?.toString().trim();
  const testDate = formData.get('labTestDate')?.toString().trim() || undefined;
  const labNameVal = formData.get('labLabName')?.toString().trim() || undefined;

  const labResults: LabResults | undefined =
    thcRaw || cbdRaw || terpenesRaw || testDate || labNameVal
      ? {
          ...(thcRaw ? { thcPercent: parseFloat(thcRaw) } : {}),
          ...(cbdRaw ? { cbdPercent: parseFloat(cbdRaw) } : {}),
          ...(terpenesRaw
            ? {
                terpenes: terpenesRaw
                  .split(',')
                  .map(t => t.trim())
                  .filter(Boolean),
              }
            : {}),
          ...(testDate ? { testDate } : {}),
          ...(labNameVal ? { labName: labNameVal } : {}),
        }
      : undefined;

  try {
    await upsertProduct({
      slug: existing.slug,
      name,
      category,
      description,
      details,
      image: featuredImagePath ?? existing.image,
      images:
        galleryImagePaths.length > 0 ? galleryImagePaths : existing.images,
      status,
      federalDeadlineRisk,
      availableAt,
      ...(vendorSlug ? { vendorSlug } : {}),
      ...(leaflyUrl ? { leaflyUrl } : {}),
      ...(coaUrl
        ? { coaUrl }
        : existing.coaUrl
          ? { coaUrl: existing.coaUrl }
          : {}),
      ...(labResults ? { labResults } : {}),
    });

    revalidatePath('/admin/products');
    revalidatePath('/products');
    revalidatePath(`/products/${existing.slug}`);

    redirect('/admin/products');
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
    return { error: 'Failed to save. Please try again.' };
  }
}
