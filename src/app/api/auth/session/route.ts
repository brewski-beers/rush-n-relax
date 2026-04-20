import { getAdminAuth } from '@/lib/firebase/admin';
import {
  getPendingUserInviteByEmail,
  markPendingUserInviteAccepted,
  normalizeInviteEmail,
} from '@/lib/repositories';
import type { UserRole } from '@/types';

const SESSION_DURATION_MS = 60 * 60 * 24 * 5 * 1000; // 5 days
const SESSION_MAX_AGE_S = 60 * 60 * 24 * 5; // 5 days in seconds

const OWNER_ROLE: UserRole = 'owner';
const CLAIMS_UPDATED_RETRY_CODE = 'CLAIMS_UPDATED_RETRY';

// Auth session requests must never be cached by browsers or CDNs.
const NO_STORE: HeadersInit = { 'Cache-Control': 'no-store' };

function jsonNoStore(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

function getRoleClaim(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload === null) {
    return undefined;
  }

  return (payload as Record<string, unknown>).role;
}

function isUserRole(value: unknown): value is UserRole {
  return (
    value === 'customer' ||
    value === 'staff' ||
    value === 'storeOwner' ||
    value === 'storeManager' ||
    value === 'owner'
  );
}

function isStaffOrAbove(role: UserRole): boolean {
  return role !== 'customer';
}

function parseOwnerAllowlist(): Set<string> {
  return new Set(
    (process.env.ADMIN_OWNER_ALLOWLIST ?? '')
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * POST /api/auth/session
 * Exchange a Firebase ID token for a server-side session cookie.
 * Body: { idToken: string }
 *
 * Session cookie is issued only when the user holds a recognized, non-customer role.
 * Gate: isUserRole(roleClaim) && roleClaim !== 'customer'
 *
 * Cache-Control: no-store on every response — session issuance must not be
 * cached by browsers or intermediaries.
 */
export async function POST(request: Request): Promise<Response> {
  let idToken: string;

  try {
    const body: unknown = await request.json();

    if (typeof body !== 'object' || body === null) {
      return jsonNoStore({ error: 'idToken required' }, 400);
    }

    const tokenValue = (body as { idToken?: unknown }).idToken;
    if (typeof tokenValue !== 'string' || tokenValue.length === 0) {
      return jsonNoStore({ error: 'idToken required' }, 400);
    }

    idToken = tokenValue;
  } catch {
    return jsonNoStore({ error: 'Invalid request body' }, 400);
  }

  try {
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const roleClaim = getRoleClaim(decoded);
    const normalizedEmail = decoded.email
      ? normalizeInviteEmail(decoded.email)
      : undefined;

    // Owner allowlist bootstrap: elevate the user to owner then ask client to retry.
    if (roleClaim !== OWNER_ROLE && normalizedEmail) {
      const isAllowlisted = parseOwnerAllowlist().has(normalizedEmail);

      if (isAllowlisted) {
        const userRecord = await adminAuth.getUser(decoded.uid);
        await adminAuth.setCustomUserClaims(decoded.uid, {
          ...(userRecord.customClaims ?? {}),
          role: OWNER_ROLE,
        });

        return jsonNoStore(
          {
            error: 'Owner claim applied. Refreshing token required.',
            code: CLAIMS_UPDATED_RETRY_CODE,
          },
          409
        );
      }
    }

    // Email invite flow: apply the pending role then ask client to retry.
    if (!isUserRole(roleClaim) || !isStaffOrAbove(roleClaim)) {
      if (normalizedEmail) {
        const pendingInvite =
          await getPendingUserInviteByEmail(normalizedEmail);

        if (pendingInvite) {
          const userRecord = await adminAuth.getUser(decoded.uid);
          const currentRole = getRoleClaim(userRecord.customClaims);

          if (currentRole !== pendingInvite.role) {
            await adminAuth.setCustomUserClaims(decoded.uid, {
              ...(userRecord.customClaims ?? {}),
              role: pendingInvite.role,
            });
          }

          await markPendingUserInviteAccepted({
            email: normalizedEmail,
            acceptedByUid: decoded.uid,
          });

          return jsonNoStore(
            {
              error: 'Invite role applied. Refreshing token required.',
              code: CLAIMS_UPDATED_RETRY_CODE,
            },
            409
          );
        }
      }

      // No valid staff-or-above role and no pending invite — reject.
      return jsonNoStore({ error: 'Forbidden' }, 403);
    }

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });

    const cookieHeader = [
      `__session=${sessionCookie}`,
      `Max-Age=${SESSION_MAX_AGE_S}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Strict',
      process.env.NODE_ENV === 'production' ? 'Secure' : '',
    ]
      .filter(Boolean)
      .join('; ');

    return new Response(null, {
      status: 200,
      headers: {
        'Set-Cookie': cookieHeader,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[auth/session] createSessionCookie failed:', err);
    return jsonNoStore({ error: 'Failed to create session' }, 401);
  }
}

/**
 * DELETE /api/auth/session
 * Clear the session cookie (logout).
 *
 * Cache-Control: no-store — logout must never be cached.
 */
export function DELETE(): Response {
  const cookieHeader = [
    '__session=',
    'Max-Age=0',
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
  return new Response(null, {
    status: 200,
    headers: {
      'Set-Cookie': cookieHeader,
      'Cache-Control': 'no-store',
    },
  });
}
