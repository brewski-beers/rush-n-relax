import { getAdminAuth } from '@/lib/firebase/admin';

const SESSION_DURATION_MS = 60 * 60 * 24 * 5 * 1000; // 5 days
const SESSION_MAX_AGE_S = 60 * 60 * 24 * 5; // 5 days in seconds

/**
 * POST /api/auth/session
 * Exchange a Firebase ID token for a server-side session cookie.
 * Body: { idToken: string }
 */
export async function POST(request: Request): Promise<Response> {
  let idToken: string;

  try {
    const body: unknown = await request.json();

    if (typeof body !== 'object' || body === null) {
      return Response.json({ error: 'idToken required' }, { status: 400 });
    }

    const tokenValue = (body as { idToken?: unknown }).idToken;
    if (typeof tokenValue !== 'string' || tokenValue.length === 0) {
      return Response.json({ error: 'idToken required' }, { status: 400 });
    }

    idToken = tokenValue;
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, {
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
      headers: { 'Set-Cookie': cookieHeader },
    });
  } catch (err) {
    console.error('[auth/session] createSessionCookie failed:', err);
    return Response.json(
      { error: 'Failed to create session' },
      { status: 401 }
    );
  }
}

/**
 * DELETE /api/auth/session
 * Clear the session cookie (logout).
 */
export function DELETE(): Response {
  const cookieHeader =
    '__session=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict';
  return new Response(null, {
    status: 200,
    headers: { 'Set-Cookie': cookieHeader },
  });
}
