'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import {
  upsertProduct,
  getProductBySlug,
  listActiveCategories,
} from '@/lib/repositories';
import type { ProductStrain, ProductVariant } from '@/types';

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
  const federalDeadlineRisk = formData.get('federalDeadlineRisk') === 'true';
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
  if (!activeCategories.some(c => c.slug === category)) {
    return { error: 'Invalid category.' };
  }

  const existing = await getProductBySlug(slug);
  if (existing)
    return { error: `A product with slug "${slug}" already exists.` };

  const featuredImagePath =
    formData.get('featuredImagePath')?.toString() || undefined;

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

  // ── Variants ──────────────────────────────────────────────────────────────
  const variantsRaw = formData.get('variants')?.toString() ?? '';
  let variants: ProductVariant[] | undefined;
  if (variantsRaw) {
    try {
      const parsed: unknown = JSON.parse(variantsRaw);
      if (Array.isArray(parsed)) {
        variants = parsed.filter(
          (v): v is ProductVariant =>
            v !== null &&
            typeof v === 'object' &&
            typeof (v as Record<string, unknown>).variantId === 'string' &&
            typeof (v as Record<string, unknown>).label === 'string'
        );
      }
    } catch {
      // malformed JSON — ignore variants
    }
  }

  await upsertProduct({
    slug,
    name,
    category,
    details,
    image: featuredImagePath,
    federalDeadlineRisk,
    availableAt,
    status: 'active',
    ...(strain !== undefined ? { strain } : {}),
    ...(effects !== undefined ? { effects } : {}),
    ...(flavors !== undefined ? { flavors } : {}),
    ...(labResults !== undefined ? { labResults } : {}),
    ...(variants !== undefined ? { variants } : {}),
    ...(leaflyUrl ? { leaflyUrl } : {}),
  });

  revalidatePath('/admin/products');
  revalidatePath('/products');
  revalidatePath(`/products/${slug}`);

  redirect('/admin/products');
}
