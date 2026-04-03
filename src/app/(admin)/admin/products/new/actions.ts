'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import {
  upsertProduct,
  getProductBySlug,
  listActiveCategories,
} from '@/lib/repositories';
import type { LabResults } from '@/types/product';

export async function createProduct(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  await requireRole('owner');

  const slug = formData.get('slug')?.toString().trim().toLowerCase();
  const name = formData.get('name')?.toString().trim();
  const category = formData.get('category')?.toString();
  const description = formData.get('description')?.toString().trim();
  const details = formData.get('details')?.toString().trim();
  const federalDeadlineRisk = formData.get('federalDeadlineRisk') === 'true';
  const availableAt = formData.getAll('availableAt').map(v => v.toString());
  const vendorSlug = formData.get('vendorSlug')?.toString().trim() || undefined;
  const leaflyUrl = formData.get('leaflyUrl')?.toString().trim() || undefined;

  if (!slug || !name || !category || !description || !details) {
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

  await upsertProduct({
    slug,
    name,
    category,
    description,
    details,
    image: featuredImagePath,
    federalDeadlineRisk,
    availableAt,
    status: 'active',
    ...(vendorSlug ? { vendorSlug } : {}),
    ...(leaflyUrl ? { leaflyUrl } : {}),
    ...(labResults ? { labResults } : {}),
  });

  revalidatePath('/admin/products');
  revalidatePath('/products');
  revalidatePath(`/products/${slug}`);

  redirect('/admin/products');
}
