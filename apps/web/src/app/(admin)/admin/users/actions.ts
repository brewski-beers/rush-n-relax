'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/admin-auth';
import { assignNonOwnerRole } from '@/lib/admin/user-management';
import { isManageableRole } from '@/lib/admin/roles';
import type { UserRole } from '@/types';
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

const ALL_ROLES: UserRole[] = [
  'owner',
  'storeOwner',
  'storeManager',
  'staff',
  'customer',
];

function isAnyRole(value: unknown): value is UserRole {
  return ALL_ROLES.includes(value as UserRole);
}

/**
 * Update any user's role — including promotion to 'owner'.
 * Caller must be an owner (enforced by requireRole).
 */
export async function updateUserRole(
  _prev: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  await requireRole('owner');

  const uid = formData.get('uid')?.toString().trim();
  const selectedRole = formData.get('role')?.toString().trim();

  if (!uid || !selectedRole) {
    return { error: 'UID and role are required.' };
  }

  if (!isAnyRole(selectedRole)) {
    return { error: 'Invalid role.' };
  }

  const { getAdminAuth } = await import('@/lib/firebase/admin');
  const auth = getAdminAuth();

  try {
    const user = await auth.getUser(uid);
    await auth.setCustomUserClaims(uid, {
      ...(user.customClaims ?? {}),
      role: selectedRole,
    });
  } catch (err: unknown) {
    if (err instanceof Error) return { error: err.message };
    return { error: 'Failed to update role.' };
  }

  revalidatePath('/admin/users');
  return { success: `Role updated to ${selectedRole}.` };
}

const EMAIL_PATTERN_SIMPLE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Link a Google email to an existing user (e.g. phone-only staff).
 * Sets email + emailVerified:true so Firebase one-account-per-email
 * will merge the Google sign-in to this record.
 */
export async function addGoogleEmail(
  _prev: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  await requireRole('owner');

  const uid = formData.get('uid')?.toString().trim();
  const email = formData.get('email')?.toString().trim().toLowerCase();

  if (!uid || !email) {
    return { error: 'UID and email are required.' };
  }

  if (!EMAIL_PATTERN_SIMPLE.test(email)) {
    return { error: 'Enter a valid email address.' };
  }

  const { getAdminAuth } = await import('@/lib/firebase/admin');
  const auth = getAdminAuth();

  try {
    await auth.updateUser(uid, { email, emailVerified: true });
  } catch (err: unknown) {
    if (err instanceof Error) return { error: err.message };
    return { error: 'Failed to link Google email.' };
  }

  revalidatePath('/admin/users');
  return {
    success: `Google email ${email} linked. User can now sign in with Google.`,
  };
}

// Accepts 10-digit US numbers; +1 is prepended server-side
const US_PHONE_PATTERN = /^\d{10}$/;

export async function provisionStaffPhone(
  _prev: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  await requireRole('owner');

  const raw = formData.get('phoneNumber')?.toString().trim() ?? '';
  const displayName =
    formData.get('displayName')?.toString().trim() || undefined;

  if (!raw) {
    return { error: 'Phone number is required.' };
  }

  if (!US_PHONE_PATTERN.test(raw)) {
    return {
      error: 'Enter a valid 10-digit US phone number (e.g. 6155550123).',
    };
  }

  const phoneNumber = `+1${raw}`;

  const { getAdminAuth } = await import('@/lib/firebase/admin');
  const auth = getAdminAuth();

  let uid: string;

  try {
    const existing = await auth.getUserByPhoneNumber(phoneNumber);
    uid = existing.uid;
    // Idempotent: if already staff, nothing changes — still set claims to ensure correctness
    await auth.setCustomUserClaims(uid, {
      ...(existing.customClaims ?? {}),
      role: 'staff',
    });
    if (displayName) {
      await auth.updateUser(uid, { displayName });
    }
  } catch (err: unknown) {
    // auth/user-not-found → create the user
    if (
      typeof err === 'object' &&
      err !== null &&
      (err as Record<string, unknown>).code === 'auth/user-not-found'
    ) {
      const created = await auth.createUser({ phoneNumber, displayName });
      uid = created.uid;
      await auth.setCustomUserClaims(uid, { role: 'staff' });
    } else if (err instanceof Error) {
      return { error: err.message };
    } else {
      return { error: 'Failed to provision staff user.' };
    }
  }

  revalidatePath('/admin/users');
  return { success: `Phone ${phoneNumber} provisioned with staff role.` };
}

export async function setStaffDisplayName(
  _prev: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  await requireRole('owner');

  const uid = formData.get('uid')?.toString().trim();
  const displayName = formData.get('displayName')?.toString().trim() ?? '';

  if (!uid) {
    return { error: 'UID is required.' };
  }

  const { getAdminAuth } = await import('@/lib/firebase/admin');
  const auth = getAdminAuth();

  try {
    await auth.updateUser(uid, { displayName: displayName || null });
  } catch (err: unknown) {
    if (err instanceof Error) {
      return { error: err.message };
    }
    return { error: 'Failed to update display name.' };
  }

  revalidatePath('/admin/users');
  return { success: 'Name updated.' };
}

export async function revokeStaffPhone(
  _prev: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  await requireRole('owner');

  const uid = formData.get('uid')?.toString().trim();

  if (!uid) {
    return { error: 'UID is required.' };
  }

  const { getAdminAuth } = await import('@/lib/firebase/admin');
  const auth = getAdminAuth();

  try {
    const user = await auth.getUser(uid);
    await auth.setCustomUserClaims(uid, {
      ...(user.customClaims ?? {}),
      role: 'customer',
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      return { error: err.message };
    }

    return { error: 'Failed to revoke staff role.' };
  }

  revalidatePath('/admin/users');
  return { success: 'Staff role revoked. User demoted to customer.' };
}
