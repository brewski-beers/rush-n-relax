'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/admin-auth';
import { assignNonOwnerRole } from '@/lib/admin/user-management';
import { isManageableRole } from '@/lib/admin/roles';
import {
  createOrUpdatePendingUserInvite,
  revokePendingUserInvite,
} from '@/lib/repositories';

interface ActionState {
  error?: string;
  success?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export async function inviteUser(
  _prev: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const actor = await requireRole('owner');

  const email = formData.get('email')?.toString().trim().toLowerCase();
  const selectedRole = formData.get('role')?.toString().trim();

  if (!email || !selectedRole) {
    return { error: 'Email and role are required.' };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { error: 'Enter a valid email address.' };
  }

  if (!isManageableRole(selectedRole)) {
    return { error: 'Invalid role selected.' };
  }

  await createOrUpdatePendingUserInvite({
    email,
    role: selectedRole,
    invitedByUid: actor.uid,
    invitedByEmail: actor.email,
  });

  revalidatePath('/admin/users');
  return {
    success: `Invite saved for ${email}. The user should sign in with Google using this email.`,
  };
}

export async function revokeInvite(
  _prev: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  await requireRole('owner');

  const email = formData.get('email')?.toString().trim().toLowerCase();

  if (!email) {
    return { error: 'Invite email is required.' };
  }

  await revokePendingUserInvite(email);

  revalidatePath('/admin/users');
  return { success: `Invite revoked for ${email}.` };
}
