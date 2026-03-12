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
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';
import type { UserRole } from '@/types';

const ROLE_RANK: Record<UserRole, number> = {
  staff: 1,
  manager: 2,
  owner: 3,
  superadmin: 4,
};

/**
 * Verify the caller holds at least `minRole`.
 * Throws with 'Unauthorized' (no session) or 'Forbidden' (insufficient role).
 * Call at the top of every admin Server Action.
 */
export async function requireRole(minRole: UserRole): Promise<void> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) throw new Error('Unauthorized');

  const decoded = await getAdminAuth().verifySessionCookie(
    sessionCookie,
    true /* checkRevoked */
  );

  const userDoc = await getAdminFirestore()
    .collection('users')
    .doc(decoded.uid)
    .get();

  if (!userDoc.exists) throw new Error('Forbidden');

  const role = userDoc.data()?.role as UserRole | undefined;
  if (!role || (ROLE_RANK[role] ?? 0) < ROLE_RANK[minRole]) {
    throw new Error('Forbidden');
  }
}
