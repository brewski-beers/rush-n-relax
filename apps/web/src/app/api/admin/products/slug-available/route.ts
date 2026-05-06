/**
 * GET /api/admin/products/slug-available?slug=<slug>
 * Admin-guarded availability check for a candidate product slug.
 *
 * Auth: requires a verified `__session` cookie carrying at least the `staff`
 * custom claim (same posture as other admin write/upload routes — staff create
 * products today). Missing/invalid session → 401, insufficient role → 403.
 *
 * Unlike `requireRole()` (which `redirect()`s, suitable for page nav), this
 * route returns explicit JSON status codes so the client wizard can branch on
 * them. The server-side guard inside the `createProduct` action remains the
 * authoritative backstop — this endpoint is purely a UX hint.
 *
 * Returns: { available: boolean }  on 200
 *          { error: string }       on 400/401/403
 */
import { cookies } from 'next/headers';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { getAdminAuth } from '@/lib/firebase/admin';
import { getProductBySlug } from '@/lib/repositories';
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
    value === 'storeManager' ||
    value === 'storeOwner' ||
    value === 'owner'
  );
}

const SLUG_PATTERN = /^[a-z0-9-]+$/;
const MIN_ROLE: UserRole = 'staff';

const NO_STORE: HeadersInit = { 'Cache-Control': 'no-store' };

export async function GET(request: Request): Promise<Response> {
  // --- Auth: verify session cookie + role -------------------------------
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) {
    return Response.json(
      { error: 'Unauthorized.' },
      { status: 401, headers: NO_STORE }
    );
  }

  let decoded: DecodedIdToken;
  try {
    decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
  } catch {
    return Response.json(
      { error: 'Unauthorized.' },
      { status: 401, headers: NO_STORE }
    );
  }

  const roleClaim = (decoded as unknown as Record<string, unknown>).role;
  const role = isUserRole(roleClaim) ? roleClaim : undefined;
  if (!role || ROLE_RANK[role] < ROLE_RANK[MIN_ROLE]) {
    return Response.json(
      { error: 'Forbidden.' },
      { status: 403, headers: NO_STORE }
    );
  }

  // --- Validate input ---------------------------------------------------
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug')?.trim() ?? '';
  if (!slug || !SLUG_PATTERN.test(slug)) {
    return Response.json(
      { error: 'Invalid slug.' },
      { status: 400, headers: NO_STORE }
    );
  }

  // --- Lookup -----------------------------------------------------------
  const existing = await getProductBySlug(slug);
  return Response.json(
    { available: !existing },
    { status: 200, headers: NO_STORE }
  );
}
