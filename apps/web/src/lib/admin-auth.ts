'use server';

/**
 * Admin authorization utilities — server-side only.
 * Verifies the session cookie and checks the caller's custom auth claim.
 *
 * Usage in Server Actions:
 *   await requireRole('owner');
 *
 * Role hierarchy (lowest → highest): customer < staff < storeManager < storeOwner < owner
 * All admin CMS reads and writes currently require 'owner'.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { getAdminAuth } from '@/lib/firebase/admin';
import type { UserRole } from '@/types';

const ROLE_RANK: Record<UserRole, number> = {
  customer: 0,
  staff: 1,
  storeManager: 2,
  storeOwner: 3,
  owner: 4,
};

function isUserRole(value: unknown): value is UserRole {
  return (
    value === 'customer' ||
    value === 'staff' ||
    value === 'storeOwner' ||
    value === 'storeManager' ||
    value === 'owner'
  );
}

function getRoleClaim(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload === null) {
    return undefined;
  }

  return (payload as Record<string, unknown>).role;
}

export interface AdminActorContext {
  uid: string;
  email: string;
  role: UserRole;
  phone?: string;
}

async function resolveActorFromSessionCookie(
  sessionCookie: string,
  minRole: UserRole
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

  const roleValue = getRoleClaim(decoded);

  const role = isUserRole(roleValue) ? roleValue : undefined;
  if (!role || (ROLE_RANK[role] ?? 0) < ROLE_RANK[minRole]) {
    return null;
  }

  return {
    uid: decoded.uid,
    email: decoded.email ?? '',
    role,
    phone: decoded.phone_number ?? undefined,
  };
}

/**
 * Lightweight session check for server-rendered UI (no redirects).
 */
export async function hasAdminSession(minRole: UserRole = 'owner') {
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

  const actor = await resolveActorFromSessionCookie(sessionCookie, minRole);
  if (!actor) {
    // Covers stale/revoked/invalid cookies and insufficient role.
    redirect('/admin/login');
  }

  return actor;
}

/**
 * Decode the role from the session cookie without full verification.
 * Used in server-rendered layouts where we only need the role for UI filtering.
 * Full verification still happens in requireRole() in every Server Action.
 */
export async function getAdminRole(): Promise<UserRole | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) return null;

  // Session cookies are structured as JWTs: header.payload.signature
  // We only base64-decode the payload — no signature verification here.
  // requireRole() in every Server Action performs full cryptographic verification.
  try {
    const parts = sessionCookie.split('.');
    if (parts.length < 2) return null;
    // base64url → standard base64
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded);
    const payload: unknown = JSON.parse(json);
    const role = getRoleClaim(payload);
    return isUserRole(role) ? role : null;
  } catch {
    return null;
  }
}
