'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/admin-auth';
import {
  setProductStatus,
  upsertVariantTemplate,
  deleteVariantTemplate,
  listArchivedProducts,
} from '@/lib/repositories';
import type { ProductSummary } from '@/types';
import type { VariantGroup } from '@/types/product';

export async function archiveProduct(slug: string): Promise<void> {
  await requireRole('staff');
  await setProductStatus(slug, 'archived');
  revalidatePath('/admin/products');
  revalidatePath('/products');
  revalidatePath(`/products/${slug}`);
}

export async function restoreProduct(slug: string): Promise<void> {
  await requireRole('staff');
  await setProductStatus(slug, 'active');
  revalidatePath('/admin/products');
  revalidatePath('/products');
  revalidatePath(`/products/${slug}`);
}

export async function fetchArchivedProductsAction(): Promise<ProductSummary[]> {
  await requireRole('staff');
  return listArchivedProducts();
}

export async function saveVariantTemplateAction(
  key: string,
  label: string,
  group: VariantGroup
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    await requireRole('staff');
    const id = await upsertVariantTemplate({ key, label, group });
    return { ok: true, id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export async function deleteVariantTemplateAction(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireRole('staff');
    await deleteVariantTemplate(id);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
