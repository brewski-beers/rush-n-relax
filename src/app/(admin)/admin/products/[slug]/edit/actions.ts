'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import {
  upsertProduct,
  clearProductFields,
  getProductBySlug,
  listActiveCategories,
  setProductStatus,
} from '@/lib/repositories';
import { generateSkus } from '@/lib/variants/generateSkus';
import type {
  ProductStrain,
  ProductStatus,
  VariantGroup,
  NutritionFacts,
} from '@/types';

const SETTABLE_STATUSES: ProductStatus[] = ['active', 'pending-reformulation', 'archived'];

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
  const actor = await requireRole('staff');

  const existing = await getProductBySlug(slug);
  if (!existing) return { error: 'Product not found.' };

  const name = formData.get('name')?.toString().trim();
  const category = formData.get('category')?.toString();
  const details = formData.get('details')?.toString().trim();
  const availableAt = existing.availableAt; // managed in Inventory, not via product edit

  if (!name || !category || !details) {
    return { error: 'All required fields must be filled.' };
  }

  const activeCategories = await listActiveCategories();
  const selectedCategory = activeCategories.find(c => c.slug === category);
  if (!selectedCategory) {
    return { error: 'Invalid category.' };
  }

  // Status is only editable by owners. If the field is absent from FormData
  // (non-owner users don't see it in the wizard), fall back to the existing value.
  // compliance-hold can never be changed here — always preserved.
  let status: ProductStatus;
  if (existing.status === 'compliance-hold') {
    status = 'compliance-hold';
  } else if (actor.role === 'owner') {
    const rawStatus = formData.get('status')?.toString() as ProductStatus | undefined;
    if (rawStatus && SETTABLE_STATUSES.includes(rawStatus)) {
      status = rawStatus;
    } else {
      status = existing.status;
    }
  } else {
    // Non-owner staff cannot change status — preserve existing
    status = existing.status;
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

  // Suppress unused variable warning — featuredFromForm is an intentional guard
  void featuredFromForm;

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

  // ── Vendor ────────────────────────────────────────────────────────────────
  const vendorSlug =
    formData.get('vendorSlug')?.toString().trim() || existing.vendorSlug;

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

  // ── Leafly URL ─────────────────────────────────────────────────────────
  const leaflyUrlRaw = formData.get('leaflyUrl')?.toString().trim() ?? '';
  const leaflyUrl = leaflyUrlRaw || existing.leaflyUrl;

  // ── COA URL ────────────────────────────────────────────────────────────
  const coaUrlRaw = formData.get('coaUrl')?.toString() ?? '';
  const coaUrl = coaUrlRaw || existing.coaUrl;

  // ── Vendor product URL ─────────────────────────────────────────────────
  const vendorProductUrlRaw = formData.get('vendorProductUrl')?.toString().trim() ?? '';
  const vendorProductUrl = vendorProductUrlRaw || existing.vendorProductUrl;

  // ── Variant groups + generated SKUs ──────────────────────────────────────
  const variantGroupsRaw = formData.get('variantGroups');
  const variantGroups: VariantGroup[] = variantGroupsRaw
    ? (JSON.parse(variantGroupsRaw as string) as VariantGroup[])
    : (existing.variantGroups ?? []);
  const variants = generateSkus(variantGroups);

  // ── Vape attributes ───────────────────────────────────────────────────────
  const extractionType =
    formData.get('extractionType')?.toString().trim() ||
    existing.extractionType;
  const hardwareType =
    formData.get('hardwareType')?.toString().trim() || existing.hardwareType;
  const volumeMlRaw = formData.get('volumeMl')?.toString() ?? '';
  const volumeMl =
    volumeMlRaw !== '' && Number.isFinite(Number(volumeMlRaw))
      ? Number(volumeMlRaw)
      : existing.volumeMl;

  // ── Drink attributes ──────────────────────────────────────────────────────
  const thcMgRaw = formData.get('thcMgPerServing')?.toString() ?? '';
  const cbdMgRaw = formData.get('cbdMgPerServing')?.toString() ?? '';
  const thcMgPerServing =
    thcMgRaw !== '' && Number.isFinite(Number(thcMgRaw))
      ? Number(thcMgRaw)
      : existing.thcMgPerServing;
  const cbdMgPerServing =
    cbdMgRaw !== '' && Number.isFinite(Number(cbdMgRaw))
      ? Number(cbdMgRaw)
      : existing.cbdMgPerServing;

  // -- Nutrition Facts — shown when category has requiresNutritionFacts flag ----
  let nutritionFacts: NutritionFacts | undefined;
  if (selectedCategory.requiresNutritionFacts) {
    const nfServingSize =
      formData.get('nfServingSize')?.toString().trim() ?? '';
    const nfSpcRaw =
      formData.get('nfServingsPerContainer')?.toString().trim() ?? '';
    const nfCalRaw = formData.get('nfCalories')?.toString().trim() ?? '';
    const nfSpc = Number(nfSpcRaw);
    const nfCal = nfCalRaw !== '' ? Number(nfCalRaw) : 0;
    const calValid =
      category === 'drinks' ||
      (nfCalRaw !== '' && Number.isFinite(nfCal) && nfCal >= 0);
    if (
      nfServingSize &&
      nfSpcRaw &&
      Number.isFinite(nfSpc) &&
      nfSpc > 0 &&
      calValid
    ) {
      nutritionFacts = {
        servingSize: nfServingSize,
        servingsPerContainer: nfSpc,
        calories: nfCal,
        totalFat: formData.get('nfTotalFat')?.toString().trim() || undefined,
        sodium: formData.get('nfSodium')?.toString().trim() || undefined,
        totalCarbs:
          formData.get('nfTotalCarbs')?.toString().trim() || undefined,
        sugars: formData.get('nfSugars')?.toString().trim() || undefined,
        protein: formData.get('nfProtein')?.toString().trim() || undefined,
      };
    } else {
      // category requires nutrition facts but no form data — preserve existing
      nutritionFacts = existing.nutritionFacts;
    }
  }

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
    availableAt,
    ...(vendorSlug ? { vendorSlug } : {}),
    ...(coaUrl ? { coaUrl } : {}),
    ...(strain !== undefined ? { strain } : {}),
    ...(effects !== undefined ? { effects } : {}),
    ...(flavors !== undefined ? { flavors } : {}),
    ...(labResults !== undefined ? { labResults } : {}),
    ...(variantGroups.length > 0 ? { variantGroups } : {}),
    ...(variants.length > 0 ? { variants } : {}),
    ...(nutritionFacts !== undefined ? { nutritionFacts } : {}),
    ...(leaflyUrl ? { leaflyUrl } : {}),
    ...(vendorProductUrl ? { vendorProductUrl } : {}),
    ...(extractionType ? { extractionType } : {}),
    ...(hardwareType ? { hardwareType } : {}),
    ...(volumeMl !== undefined ? { volumeMl } : {}),
    ...(thcMgPerServing !== undefined ? { thcMgPerServing } : {}),
    ...(cbdMgPerServing !== undefined ? { cbdMgPerServing } : {}),
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

export async function archiveProduct(slug: string): Promise<void> {
  await requireRole('staff');
  await setProductStatus(slug, 'archived');
  revalidatePath('/admin/products');
  revalidatePath(`/products/${slug}`);
  redirect('/admin/products');
}
