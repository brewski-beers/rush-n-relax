'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/admin-auth';
import {
  upsertVariantTemplate,
  deleteVariantTemplate,
} from '@/lib/repositories';
import type { VariantGroup } from '@/types/product';

export async function createVariantGroupAction(
  key: string,
  label: string,
  group: VariantGroup
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    await requireRole('staff');
    const id = await upsertVariantTemplate({ key, label, group });
    revalidatePath('/admin/variant-groups');
    return { ok: true, id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export async function updateVariantGroupAction(
  key: string,
  label: string,
  group: VariantGroup
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    await requireRole('staff');
    const id = await upsertVariantTemplate({ key, label, group });
    revalidatePath('/admin/variant-groups');
    return { ok: true, id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/** Used by ConfirmButton — must return void */
export async function deleteVariantGroupAction(id: string): Promise<void> {
  await requireRole('staff');
  await deleteVariantTemplate(id);
  revalidatePath('/admin/variant-groups');
}
