'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import {
  upsertProduct,
  getProductBySlug,
  listActiveCategories,
} from '@/lib/repositories';
import type { ProductStatus } from '@/types';
import type {
  LabResults,
  ProductPricing,
  PricingTier,
  WeightTier,
} from '@/types/product';

// compliance-hold is system-managed — admins cannot set it directly
const SETTABLE_STATUSES: ProductStatus[] = [
  'active',
  'pending-reformulation',
  'archived',
];

const WEIGHT_TIERS: WeightTier[] = [
  'gram',
  'eighth',
  'quarter',
  'half',
  'ounce',
];

function parseIntField(formData: FormData, key: string): number | undefined {
  const v = formData.get(key)?.toString();
  if (!v) return undefined;
  const n = parseInt(v, 10);
  return isNaN(n) ? undefined : n;
}

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
  const federalDeadlineRisk = formData.get('federalDeadlineRisk') === 'true';
  const availableAt = formData.getAll('availableAt').map(v => v.toString());
  const vendorSlug = formData.get('vendorSlug')?.toString().trim() || undefined;
  const leaflyUrl = formData.get('leaflyUrl')?.toString().trim() || undefined;

  // Status: compliance-hold is system-managed — validate before resolving
  const rawStatus = formData.get('status')?.toString() as
    | ProductStatus
    | undefined;
  // Block any attempt to set compliance-hold directly via the form
  if (rawStatus !== undefined && !SETTABLE_STATUSES.includes(rawStatus)) {
    return { error: 'Cannot set that status directly.' };
  }
  // If existing product is compliance-hold, preserve it (system-managed)
  const status: ProductStatus =
    existing.status === 'compliance-hold'
      ? 'compliance-hold'
      : (rawStatus ?? existing.status);

  if (!name || !category || !description || !details) {
    return { error: 'All required fields must be filled.' };
  }

  const activeCategories = await listActiveCategories();
  if (!activeCategories.some(c => c.slug === category)) {
    return { error: 'Invalid category.' };
  }

  const featuredImagePath =
    formData.get('featuredImagePath')?.toString() || undefined;
  const galleryImagePaths = ([0, 1, 2, 3, 4] as const)
    .map(i => formData.get(`galleryImagePath_${i}`)?.toString() || undefined)
    .filter((p): p is string => p !== undefined);

  // Build optional lab results from wizard step 4 hidden fields
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
      : existing.labResults;

  // Build pricing from hidden form fields emitted by PricingFields component
  const pricingPrice = parseIntField(formData, 'pricingPrice');
  const pricing: ProductPricing | undefined =
    pricingPrice !== undefined
      ? {
          price: pricingPrice,
          cost: parseIntField(formData, 'pricingCost'),
          compareAtPrice: parseIntField(formData, 'pricingCompareAtPrice'),
          markupPercent: parseIntField(formData, 'pricingMarkupPercent'),
          taxable: formData.get('pricingTaxable') !== 'false',
          pricingTier: (formData.get('pricingTier')?.toString() ??
            'unit') as PricingTier,
          tieredPricing: WEIGHT_TIERS.reduce(
            (acc, t) => {
              const cents = parseIntField(formData, `pricingTiered_${t}`);
              if (cents !== undefined) acc[t] = cents;
              return acc;
            },
            {} as Partial<Record<WeightTier, number>>
          ),
        }
      : existing.pricing;

  const payload = {
    slug: existing.slug,
    name,
    category,
    description,
    details,
    image: featuredImagePath ?? existing.image,
    images: galleryImagePaths.length > 0 ? galleryImagePaths : existing.images,
    status,
    federalDeadlineRisk,
    availableAt,
    ...(vendorSlug ? { vendorSlug } : {}),
    ...(leaflyUrl ? { leaflyUrl } : {}),
    ...(labResults ? { labResults } : {}),
    ...(pricing ? { pricing } : {}),
  };

  try {
    await upsertProduct({
      ...payload,
      ...(existing.coaUrl ? { coaUrl: existing.coaUrl } : {}),
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
