import type { ListUsersResult, UserRecord } from 'firebase-admin/auth';
import { getAdminAuth } from '@/lib/firebase/admin';
import type { ManageableRole } from '@/lib/admin/roles';
import type { UserRole } from '@/types';

export interface ManagedUserSummary {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole | 'unassigned';
  providers: string[];
  phoneNumber?: string;
}

function isUserRole(value: unknown): value is UserRole {
  return (
    value === 'owner' ||
    value === 'storeOwner' ||
    value === 'storeManager' ||
    value === 'staff' ||
    value === 'customer'
  );
}

function getRoleClaimFromObject(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload === null) {
    return undefined;
  }

  return (payload as Record<string, unknown>).role;
}

function roleFromClaims(record: UserRecord): UserRole | null {
  const value = getRoleClaimFromObject(record.customClaims);
  return isUserRole(value) ? value : null;
}

async function resolveUserByUidOrEmail(
  uidOrEmail: string
): Promise<UserRecord> {
  const auth = getAdminAuth();
  if (uidOrEmail.includes('@')) {
    return auth.getUserByEmail(uidOrEmail.toLowerCase());
  }

  return auth.getUser(uidOrEmail);
}

export async function assignNonOwnerRole(params: {
  uidOrEmail: string;
  role: ManageableRole;
}): Promise<void> {
  const auth = getAdminAuth();
  const lookupKey = params.uidOrEmail.trim();
  const target = await resolveUserByUidOrEmail(lookupKey);
  const currentRole = roleFromClaims(target);

  if (currentRole === 'owner') {
    throw new Error('Owner accounts cannot be modified from this panel.');
  }

  await auth.setCustomUserClaims(target.uid, {
    ...(target.customClaims ?? {}),
    role: params.role,
  });
}

export async function listManagedUsers(
  limit = 50
): Promise<ManagedUserSummary[]> {
  const auth = getAdminAuth();
  const summaries: ManagedUserSummary[] = [];

  let pageToken: string | undefined;
  while (summaries.length < limit) {
    const page: ListUsersResult = await auth.listUsers(1000, pageToken);
    for (const user of page.users) {
      const role = roleFromClaims(user);

      summaries.push({
        uid: user.uid,
        email: user.email ?? '(no email)',
        displayName: user.displayName ?? '-',
        role: role ?? 'unassigned',
        providers: user.providerData.map(p => p.providerId),
        phoneNumber: user.phoneNumber ?? undefined,
      });

      if (summaries.length >= limit) {
        break;
      }
    }

    if (!page.pageToken) {
      break;
    }

    pageToken = page.pageToken;
  }

  return summaries;
}
