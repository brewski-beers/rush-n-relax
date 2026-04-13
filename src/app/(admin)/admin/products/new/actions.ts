'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import {
  upsertProduct,
  getProductBySlug,
  listActiveCategories,
} from '@/lib/repositories';
import type { ProductStrain, EffectScores } from '@/types';

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
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    : undefined;

  const effectScores = parseEffectScores(formData);

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
    ...(whatToExpect !== undefined ? { whatToExpect } : {}),
    ...(effectScores !== undefined ? { effectScores } : {}),
  });

  revalidatePath('/admin/products');
  revalidatePath('/products');
  revalidatePath(`/products/${slug}`);

  redirect('/admin/products');
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
