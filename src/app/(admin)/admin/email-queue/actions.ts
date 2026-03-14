'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/admin-auth';
import { requeueOutboundEmailJob } from '@/lib/repositories';

interface ActionState {
  error?: string;
  success?: string;
}

export async function requeueEmailJob(
  _prev: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  await requireRole('owner');

  const jobId = formData.get('jobId')?.toString().trim();
  if (!jobId) {
    return { error: 'Job id is required.' };
  }

  await requeueOutboundEmailJob(jobId);
  revalidatePath('/admin/email-queue');
  return { success: 'Email job requeued.' };
}
