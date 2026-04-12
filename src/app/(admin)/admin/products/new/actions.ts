'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import {
  upsertProduct,
  getProductBySlug,
  listActiveCategories,
} from '@/lib/repositories';

export async function createProduct(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  await requireRole('owner');

  const slug = formData.get('slug')?.toString().trim().toLowerCase();
  const name = formData.get('name')?.toString().trim();
  const category = formData.get('category')?.toString();
  const vendorSlug = formData.get('vendorSlug')?.toString().trim() || undefined;
  const description = formData.get('description')?.toString().trim();
  const details = formData.get('details')?.toString().trim();
  const federalDeadlineRisk = formData.get('federalDeadlineRisk') === 'true';
  const availableAt = formData.getAll('availableAt').map(v => v.toString());

  // Lab results (all optional)
  const thcPctRaw = formData.get('thcPct')?.toString().trim();
  const cbdPctRaw = formData.get('cbdPct')?.toString().trim();
  const terpenesRaw = formData.get('terpenes')?.toString().trim();
  const testDateRaw = formData.get('testDate')?.toString().trim();
  const labName = formData.get('labName')?.toString().trim() || undefined;
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

  // Build optional lab results sub-object
  const thcPct =
    thcPctRaw && thcPctRaw !== '' ? parseFloat(thcPctRaw) : undefined;
  const cbdPct =
    cbdPctRaw && cbdPctRaw !== '' ? parseFloat(cbdPctRaw) : undefined;
  const terpeneList =
    terpenesRaw && terpenesRaw !== ''
      ? terpenesRaw
          .split(',')
          .map(t => t.trim())
          .filter(Boolean)
      : undefined;
  const testDate =
    testDateRaw && testDateRaw !== '' ? new Date(testDateRaw) : undefined;

  const labResults =
    thcPct !== undefined ||
    cbdPct !== undefined ||
    terpeneList !== undefined ||
    testDate !== undefined ||
    labName !== undefined
      ? { thcPct, cbdPct, terpenes: terpeneList, testDate, labName }
      : undefined;

  await upsertProduct({
    slug,
    name,
    category,
    vendorSlug,
    description,
    details,
    image: featuredImagePath,
    federalDeadlineRisk,
    availableAt,
    status: 'active',
    labResults,
    leaflyUrl,
  });

  revalidatePath('/admin/products');
  revalidatePath('/products');
  revalidatePath(`/products/${slug}`);

  redirect('/admin/products');
}
