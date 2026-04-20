'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/admin-auth';
import { deletePromo } from '@/lib/repositories';

export async function destroyPromo(slug: string): Promise<void> {
  await requireRole('owner');
  await deletePromo(slug);
  revalidatePath('/admin/promos');
}
