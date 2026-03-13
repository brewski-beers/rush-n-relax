'use server';

/**
 * Admin authorization utilities — server-side only.
 * Verifies the session cookie AND checks the caller's role in Firestore.
 *
 * Usage in Server Actions:
 *   await requireRole('superadmin');
 *
 * Role hierarchy (lowest → highest): staff < manager < owner < superadmin
 * All admin CMS writes currently require 'superadmin'. Lower roles are defined
 * here for future use when store managers / staff get scoped access.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';
import type { UserRole } from '@/types';

const ROLE_RANK: Record<UserRole, number> = {
  staff: 1,
  manager: 2,
  owner: 3,
  superadmin: 4,
};

function isUserRole(value: unknown): value is UserRole {
  return (
    value === 'staff' ||
    value === 'manager' ||
    value === 'owner' ||
    value === 'superadmin'
  );
}

export interface AdminActorContext {
  uid: string;
  email: string;
  role: UserRole;
}

async function resolveActorFromSessionCookie(
  sessionCookie: string,
  minRole: UserRole,
  options?: { bootstrapInDevelopment?: boolean }
): Promise<AdminActorContext | null> {
  let decoded: DecodedIdToken;
  try {
    decoded = await getAdminAuth().verifySessionCookie(
      sessionCookie,
      true /* checkRevoked */
    );
  } catch {
    return null;
  }

  const userDoc = await getAdminFirestore()
    .collection('users')
    .doc(decoded.uid)
    .get();

  if (!userDoc.exists) {
    if (
      options?.bootstrapInDevelopment &&
      process.env.NODE_ENV === 'development'
    ) {
      // Local emulator convenience: allow first login to bootstrap a role doc.
      await getAdminFirestore()
        .collection('users')
        .doc(decoded.uid)
        .set({
          email: decoded.email ?? '',
          displayName: decoded.email ?? 'Dev Admin',
          role: 'superadmin',
          locationIds: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      return {
        uid: decoded.uid,
        email: decoded.email ?? '',
        role: 'superadmin',
      };
    }

    return null;
  }

  const userData = userDoc.data() as unknown;
  const roleValue =
    typeof userData === 'object' && userData !== null
      ? (userData as { role?: unknown }).role
      : undefined;

  const role = isUserRole(roleValue) ? roleValue : undefined;
  if (!role || (ROLE_RANK[role] ?? 0) < ROLE_RANK[minRole]) {
    return null;
  }

  return {
    uid: decoded.uid,
    email: decoded.email ?? '',
    role,
  };
}

/**
 * Lightweight session check for server-rendered UI (no redirects).
 */
export async function hasAdminSession(minRole: UserRole = 'staff') {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) return false;

  const actor = await resolveActorFromSessionCookie(sessionCookie, minRole);
  return actor !== null;
}

/**
 * Verify the caller holds at least `minRole`.
 * Throws with 'Unauthorized' (no session) or 'Forbidden' (insufficient role).
 * Call at the top of every admin Server Action.
 */
export async function requireRole(
  minRole: UserRole
): Promise<AdminActorContext> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) redirect('/admin/login');

  const actor = await resolveActorFromSessionCookie(sessionCookie, minRole, {
    bootstrapInDevelopment: true,
  });
  if (!actor) {
    // Covers stale/revoked/invalid cookies and insufficient role.
    redirect('/admin/login');
  }

  return actor;
}
