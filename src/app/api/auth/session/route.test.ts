import { beforeEach, describe, expect, it, vi } from 'vitest';

const createSessionCookieMock = vi.fn();
const verifyIdTokenMock = vi.fn();
const getUserMock = vi.fn();
const setCustomUserClaimsMock = vi.fn();

vi.mock('@/lib/firebase/admin', () => ({
  getAdminAuth: () => ({
    createSessionCookie: createSessionCookieMock,
    verifyIdToken: verifyIdTokenMock,
    getUser: getUserMock,
    setCustomUserClaims: setCustomUserClaimsMock,
  }),
}));

import { DELETE, POST } from './route';

function createPostRequest(idToken: string): Request {
  return new Request('http://localhost/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
}

describe('auth session route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_OWNER_ALLOWLIST = '';
  });

  it('creates a session for owner role', async () => {
    verifyIdTokenMock.mockResolvedValue({
      uid: 'owner-uid',
      email: 'owner@rushnrelax.com',
      role: 'owner',
    });
    createSessionCookieMock.mockResolvedValue('session-cookie-value');

    const response = await POST(createPostRequest('valid-token'));

    expect(response.status).toBe(200);
    expect(createSessionCookieMock).toHaveBeenCalledWith('valid-token', {
      expiresIn: 432000000,
    });
    expect(response.headers.get('Set-Cookie')).toContain(
      '__session=session-cookie-value'
    );
  });

  it('bootstraps owner claim for allowlisted user and asks client to retry', async () => {
    process.env.ADMIN_OWNER_ALLOWLIST = 'owner@rushnrelax.com';
    verifyIdTokenMock.mockResolvedValue({
      uid: 'new-owner-uid',
      email: 'owner@rushnrelax.com',
    });
    getUserMock.mockResolvedValue({ customClaims: { betaFlag: true } });

    const response = await POST(createPostRequest('fresh-token'));
    const body = (await response.json()) as { code?: string };

    expect(response.status).toBe(409);
    expect(body.code).toBe('CLAIMS_UPDATED_RETRY');
    expect(setCustomUserClaimsMock).toHaveBeenCalledWith('new-owner-uid', {
      betaFlag: true,
      role: 'owner',
    });
    expect(createSessionCookieMock).not.toHaveBeenCalled();
  });

  it('returns forbidden when user is not owner and not allowlisted', async () => {
    verifyIdTokenMock.mockResolvedValue({
      uid: 'staff-uid',
      email: 'staff@rushnrelax.com',
      role: 'staff',
    });

    const response = await POST(createPostRequest('staff-token'));

    expect(response.status).toBe(403);
    expect(createSessionCookieMock).not.toHaveBeenCalled();
    expect(setCustomUserClaimsMock).not.toHaveBeenCalled();
  });

  it('clears the session cookie on delete', () => {
    const response = DELETE();
    const cookie = response.headers.get('Set-Cookie') ?? '';

    expect(response.status).toBe(200);
    expect(cookie).toContain('__session=;');
    expect(cookie).toContain('Max-Age=0');
  });
});
