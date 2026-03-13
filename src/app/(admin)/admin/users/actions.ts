'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/admin-auth';
import {
  MANAGEABLE_ROLES,
  type ManageableRole,
  assignNonOwnerRole,
} from '@/lib/admin/user-management';

interface ActionState {
  error?: string;
  success?: string;
}

function isManageableRole(value: string): value is ManageableRole {
  return (MANAGEABLE_ROLES as readonly string[]).includes(value);
}

export async function assignUserRole(
  _prev: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  await requireRole('owner');

  const uidOrEmail = formData.get('uidOrEmail')?.toString().trim();
  const selectedRole = formData.get('role')?.toString().trim();

  if (!uidOrEmail || !selectedRole) {
    return { error: 'UID/email and role are required.' };
  }

  if (!isManageableRole(selectedRole)) {
    return { error: 'Invalid role selected.' };
  }

  try {
    await assignNonOwnerRole({ uidOrEmail, role: selectedRole });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { error: error.message };
    }

    return { error: 'Failed to assign role.' };
  }

  revalidatePath('/admin/users');
  return { success: `Role updated to ${selectedRole}.` };
}
