'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import {
  upsertProduct,
  getProductBySlug,
  listActiveCategories,
} from '@/lib/repositories';
import { generateSkus } from '@/lib/variants/generateSkus';
import type { NutritionFacts, ProductStrain, VariantGroup } from '@/types';

const VALID_STRAINS = new Set<ProductStrain>([
  'indica',
  'sativa',
  'hybrid',
  'cbd',
]);

export async function createProduct(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  await requireRole('staff');

  const slug = formData.get('slug')?.toString().trim().toLowerCase();
  const name = formData.get('name')?.toString().trim();
  const category = formData.get('category')?.toString();
  const details = formData.get('details')?.toString().trim();
  const vendorSlug = formData.get('vendorSlug')?.toString() || undefined;
  const availableAt = formData.getAll('availableAt').map(v => v.toString());

  if (!slug || !name || !category || !details) {
    return { error: 'All required fields must be filled.' };
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return {
      error: 'Slug must be lowercase letters, numbers, and hyphens only.',
    };
  }

  const activeCategories = await listActiveCategories();
  const selectedCategory = activeCategories.find(c => c.slug === category);
  if (!selectedCategory) {
    return { error: 'Invalid category.' };
  }

  const existing = await getProductBySlug(slug);
  if (existing)
    return { error: `A product with slug "${slug}" already exists.` };

  const featuredImagePath =
    formData.get('featuredImagePath')?.toString() || undefined;

  // ── COA URL ───────────────────────────────────────────────────────────────
  const coaUrl = formData.get('coaUrl')?.toString().trim() || undefined;

  // ── Leafly URL ─────────────────────────────────────────────────────────────
  const leaflyUrl = formData.get('leaflyUrl')?.toString().trim() || undefined;

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

  const labResults =
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

  // ── Vape attributes ───────────────────────────────────────────────────────
  const extractionType =
    formData.get('extractionType')?.toString().trim() || undefined;
  const hardwareType =
    formData.get('hardwareType')?.toString().trim() || undefined;
  const volumeMlRaw = formData.get('volumeMl')?.toString() ?? '';
  const volumeMl =
    volumeMlRaw !== '' && Number.isFinite(Number(volumeMlRaw))
      ? Number(volumeMlRaw)
      : undefined;

  // ── Drink attributes ──────────────────────────────────────────────────────
  const thcMgRaw = formData.get('thcMgPerServing')?.toString() ?? '';
  const cbdMgRaw = formData.get('cbdMgPerServing')?.toString() ?? '';
  const thcMgPerServing =
    thcMgRaw !== '' && Number.isFinite(Number(thcMgRaw))
      ? Number(thcMgRaw)
      : undefined;
  const cbdMgPerServing =
    cbdMgRaw !== '' && Number.isFinite(Number(cbdMgRaw))
      ? Number(cbdMgRaw)
      : undefined;

  // ── Variant groups + generated SKUs ──────────────────────────────────────
  const variantGroupsRaw = formData.get('variantGroups');
  const variantGroups: VariantGroup[] = variantGroupsRaw
    ? (JSON.parse(variantGroupsRaw as string) as VariantGroup[])
    : [];
  const variants = generateSkus(variantGroups);

  // ── Nutrition Facts — shown when category has requiresNutritionFacts flag ----
  let nutritionFacts: NutritionFacts | undefined;
  if (selectedCategory.requiresNutritionFacts) {
    const nfServingSize =
      formData.get('nfServingSize')?.toString().trim() ?? '';
    const nfSpcRaw =
      formData.get('nfServingsPerContainer')?.toString().trim() ?? '';
    const nfCalRaw = formData.get('nfCalories')?.toString().trim() ?? '';
    const nfSpc = Number(nfSpcRaw);
    const nfCal = Number(nfCalRaw);
    if (
      nfServingSize &&
      nfSpcRaw &&
      Number.isFinite(nfSpc) &&
      nfSpc > 0 &&
      nfCalRaw &&
      Number.isFinite(nfCal) &&
      nfCal >= 0
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
    }
  }

  await upsertProduct({
    slug,
    name,
    category,
    details,
    image: featuredImagePath,
    availableAt,
    status: 'active',
    ...(vendorSlug !== undefined ? { vendorSlug } : {}),
    ...(coaUrl !== undefined ? { coaUrl } : {}),
    ...(leaflyUrl !== undefined ? { leaflyUrl } : {}),
    ...(strain !== undefined ? { strain } : {}),
    ...(effects !== undefined ? { effects } : {}),
    ...(flavors !== undefined ? { flavors } : {}),
    ...(labResults !== undefined ? { labResults } : {}),
    ...(variantGroups.length > 0 ? { variantGroups } : {}),
    ...(variants.length > 0 ? { variants } : {}),
    ...(extractionType !== undefined ? { extractionType } : {}),
    ...(hardwareType !== undefined ? { hardwareType } : {}),
    ...(volumeMl !== undefined ? { volumeMl } : {}),
    ...(thcMgPerServing !== undefined ? { thcMgPerServing } : {}),
    ...(cbdMgPerServing !== undefined ? { cbdMgPerServing } : {}),
    ...(nutritionFacts !== undefined ? { nutritionFacts } : {}),
  });

  revalidatePath('/admin/products');
  revalidatePath('/products');
  revalidatePath(`/products/${slug}`);

  redirect('/admin/products');
}
