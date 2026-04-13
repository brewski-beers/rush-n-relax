'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import {
  upsertProduct,
  getProductBySlug,
  listActiveCategories,
} from '@/lib/repositories';
import type { ProductStatus, ProductStrain, EffectScores } from '@/types';

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
  const description = formData.get('description')?.toString().trim();
  const details = formData.get('details')?.toString().trim();
  const status = formData.get('status')?.toString() as ProductStatus;
  const federalDeadlineRisk = formData.get('federalDeadlineRisk') === 'true';
  const availableAt = formData.getAll('availableAt').map(v => v.toString());

  if (!name || !category || !description || !details || !status) {
    return { error: 'All required fields must be filled.' };
  }

  const activeCategories = await listActiveCategories();
  if (!activeCategories.some(c => c.slug === category)) {
    return { error: 'Invalid category.' };
  }

  if (!SETTABLE_STATUSES.includes(status)) {
    return { error: 'Cannot set that status directly.' };
  }

  const featuredImagePath =
    formData.get('featuredImagePath')?.toString() || undefined;
  const galleryImagePaths = ([0, 1, 2, 3, 4] as const)
    .map(i => formData.get(`galleryImagePath_${i}`)?.toString() || undefined)
    .filter((p): p is string => p !== undefined);

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

  const whatToExpectRaw = formData.get('whatToExpect')?.toString() ?? '';
  const whatToExpect = whatToExpectRaw
    ? whatToExpectRaw
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
    : undefined;

  const effectScores = parseEffectScores(formData);

  // ── COA URL ────────────────────────────────────────────────────────────
  const coaUrlRaw = formData.get('coaUrl')?.toString() ?? '';
  const coaUrl = coaUrlRaw || existing.coaUrl;

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
    ...(coaUrl ? { coaUrl } : {}),
    ...(strain !== undefined ? { strain } : {}),
    ...(effects !== undefined ? { effects } : {}),
    ...(flavors !== undefined ? { flavors } : {}),
    ...(whatToExpect !== undefined ? { whatToExpect } : {}),
    ...(effectScores !== undefined ? { effectScores } : {}),
  };

  try {
    await upsertProduct(payload);

    revalidatePath('/admin/products');
    revalidatePath('/products');
    revalidatePath(`/products/${existing.slug}`);

    redirect('/admin/products');
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
    return { error: 'Failed to save. Please try again.' };
  }
}

/** Parse effect score fields from FormData. Returns undefined if all blank. */
function parseEffectScores(formData: FormData): EffectScores | undefined {
  const parse = (key: string): number | undefined => {
    const raw = formData.get(key)?.toString() ?? '';
    if (raw === '') return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : undefined;
  };

  const scores: EffectScores = {
    relaxation: parse('effectScores_relaxation'),
    energy: parse('effectScores_energy'),
    creativity: parse('effectScores_creativity'),
    euphoria: parse('effectScores_euphoria'),
    focus: parse('effectScores_focus'),
    painRelief: parse('effectScores_painRelief'),
  };

  const hasAny = Object.values(scores).some(v => v !== undefined);
  return hasAny ? scores : undefined;
}
