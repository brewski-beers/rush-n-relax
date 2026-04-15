'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import {
  upsertProduct,
  clearProductFields,
  getProductBySlug,
  listActiveCategories,
} from '@/lib/repositories';
import type { ProductStatus, ProductStrain } from '@/types';

// compliance-hold is system-managed — admins cannot set it directly
const SETTABLE_STATUSES: ProductStatus[] = [
  'active',
  'pending-reformulation',
  'archived',
];

const VALID_STRAINS = new Set<ProductStrain>([
  'indica',
  'sativa',
  'hybrid',
  'cbd',
]);

export async function updateProduct(
  slug: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  await requireRole('staff');

  const existing = await getProductBySlug(slug);
  if (!existing) return { error: 'Product not found.' };

  const name = formData.get('name')?.toString().trim();
  const category = formData.get('category')?.toString();
  const details = formData.get('details')?.toString().trim();
  const status = formData.get('status')?.toString() as ProductStatus;
  const federalDeadlineRisk = formData.get('federalDeadlineRisk') === 'true';
  const availableAt = formData.getAll('availableAt').map(v => v.toString());

  if (!name || !category || !details || !status) {
    return { error: 'All required fields must be filled.' };
  }

  const activeCategories = await listActiveCategories();
  if (!activeCategories.some(c => c.slug === category)) {
    return { error: 'Invalid category.' };
  }

  if (!SETTABLE_STATUSES.includes(status)) {
    return { error: 'Cannot set that status directly.' };
  }

  // formData.get() returns:
  //   null   — field not in form (ProductImageUpload not rendered)
  //   ''     — hidden input rendered but image was cleared by the user
  //   'path' — storage path (image unchanged or newly uploaded)
  //
  // Only '' (explicitly cleared) should trigger FieldValue.delete().
  // null means the widget wasn't rendered — fall back to existing value.
  const rawFeaturedPath = formData.get('featuredImagePath'); // null | string
  const rawGalleryPaths = ([0, 1, 2, 3, 4] as const).map(i =>
    formData.get(`galleryImagePath_${i}`)
  ); // (null | string)[]

  const featuredImagePath =
    typeof rawFeaturedPath === 'string' && rawFeaturedPath !== ''
      ? rawFeaturedPath
      : undefined;
  const featuredCleared = rawFeaturedPath === ''; // '' = explicitly removed
  const featuredFromForm = rawFeaturedPath !== null; // null = widget not rendered

  const galleryImagePaths = rawGalleryPaths.filter(
    (p): p is string => typeof p === 'string' && p !== ''
  );
  // Gallery is "cleared" only when ALL slots were rendered (non-null) and all empty
  const galleryRendered = rawGalleryPaths.every(p => p !== null);
  const galleryCleared =
    galleryRendered &&
    galleryImagePaths.length === 0 &&
    existing.images !== undefined &&
    existing.images.length > 0;

  // ── Cannabis profile fields ────────────────────────────────────────────
  const strainRaw = formData.get('strain')?.toString() ?? '';
  const strain = VALID_STRAINS.has(strainRaw as ProductStrain)
    ? (strainRaw as ProductStrain)
    : undefined;

  const effectsRaw = formData.get('effects')?.toString() ?? '';
  const effects = effectsRaw
    ? effectsRaw
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    : undefined;

  const flavorsRaw = formData.get('flavors')?.toString() ?? '';
  const flavors = flavorsRaw
    ? flavorsRaw
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    : undefined;

  // ── Lab results ────────────────────────────────────────────────────────
  const labThc = formData.get('labResults_thcPercent')?.toString() ?? '';
  const labCbd = formData.get('labResults_cbdPercent')?.toString() ?? '';
  const terpenesRaw = formData.get('terpenes')?.toString() ?? '';
  const testDate =
    formData.get('labResults_testDate')?.toString().trim() || undefined;
  const labName =
    formData.get('labResults_labName')?.toString().trim() || undefined;

  const thcPercent =
    labThc !== '' && Number.isFinite(Number(labThc))
      ? Number(labThc)
      : undefined;
  const cbdPercent =
    labCbd !== '' && Number.isFinite(Number(labCbd))
      ? Number(labCbd)
      : undefined;
  const terpenes = terpenesRaw
    ? terpenesRaw
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    : undefined;

  const labResultsFromForm =
    thcPercent !== undefined ||
    cbdPercent !== undefined ||
    terpenes !== undefined ||
    testDate ||
    labName
      ? {
          ...(thcPercent !== undefined && { thcPercent }),
          ...(cbdPercent !== undefined && { cbdPercent }),
          ...(terpenes !== undefined && { terpenes }),
          ...(testDate && { testDate }),
          ...(labName && { labName }),
        }
      : undefined;

  const labResults = labResultsFromForm ?? existing.labResults;

  // ── COA URL ────────────────────────────────────────────────────────────
  const coaUrlRaw = formData.get('coaUrl')?.toString() ?? '';
  const coaUrl = coaUrlRaw || existing.coaUrl;

  const payload = {
    slug: existing.slug,
    name,
    category,
    details,
    // image: use new path if provided, fall back to existing if widget not
    // rendered (null), or omit entirely if explicitly cleared (handled below
    // via clearProductFields). set({ merge: true }) won't remove fields, so
    // we must NOT include the key when clearing — FieldValue.delete() does it.
    ...(featuredImagePath !== undefined
      ? { image: featuredImagePath }
      : !featuredCleared
        ? { image: existing.image }
        : {}),
    ...(galleryImagePaths.length > 0
      ? { images: galleryImagePaths }
      : !galleryCleared
        ? { images: existing.images }
        : {}),
    status,
    federalDeadlineRisk,
    availableAt,
    ...(coaUrl ? { coaUrl } : {}),
    ...(strain !== undefined ? { strain } : {}),
    ...(effects !== undefined ? { effects } : {}),
    ...(flavors !== undefined ? { flavors } : {}),
    ...(labResults !== undefined ? { labResults } : {}),
  };

  try {
    await upsertProduct(payload);

    // Explicitly remove cleared image fields — upsertProduct uses set({ merge: true })
    // which ignores undefined, so we need FieldValue.delete() for actual removal.
    const toClear: ('image' | 'images')[] = [];
    if (featuredCleared) toClear.push('image');
    if (galleryCleared) toClear.push('images');
    if (toClear.length > 0) await clearProductFields(existing.slug, toClear);

    revalidatePath('/admin/products');
    revalidatePath('/products');
    revalidatePath(`/products/${existing.slug}`);

    redirect('/admin/products');
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
    return { error: 'Failed to save. Please try again.' };
  }
}
