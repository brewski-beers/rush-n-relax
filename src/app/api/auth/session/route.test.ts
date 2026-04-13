import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createSessionCookieMock,
  verifyIdTokenMock,
  getUserMock,
  setCustomUserClaimsMock,
  getPendingUserInviteByEmailMock,
  markPendingUserInviteAcceptedMock,
} = vi.hoisted(() => ({
  createSessionCookieMock: vi.fn(),
  verifyIdTokenMock: vi.fn(),
  getUserMock: vi.fn(),
  setCustomUserClaimsMock: vi.fn(),
  getPendingUserInviteByEmailMock: vi.fn(),
  markPendingUserInviteAcceptedMock: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({
  getAdminAuth: () => ({
    createSessionCookie: createSessionCookieMock,
    verifyIdToken: verifyIdTokenMock,
    getUser: getUserMock,
    setCustomUserClaims: setCustomUserClaimsMock,
  }),
}));

vi.mock('@/lib/repositories', () => ({
  normalizeInviteEmail: (email: string) => email.trim().toLowerCase(),
  getPendingUserInviteByEmail: getPendingUserInviteByEmailMock,
  markPendingUserInviteAccepted: markPendingUserInviteAcceptedMock,
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
    getPendingUserInviteByEmailMock.mockResolvedValue(null);
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

  it('creates a session for staff role', async () => {
    // Given a valid ID token with role: 'staff'
    verifyIdTokenMock.mockResolvedValue({
      uid: 'staff-uid',
      email: 'staff@rushnrelax.com',
      role: 'staff',
    });
    createSessionCookieMock.mockResolvedValue('staff-session-cookie');

    // When the session endpoint is called
    const response = await POST(createPostRequest('staff-token'));

    // Then a session cookie is set (200)
    expect(response.status).toBe(200);
    expect(createSessionCookieMock).toHaveBeenCalledWith('staff-token', {
      expiresIn: 432000000,
    });
    expect(response.headers.get('Set-Cookie')).toContain(
      '__session=staff-session-cookie'
    );
  });

  it('creates a session for staff role with phone auth (no email)', async () => {
    // Given a phone-auth staff user — no email field
    verifyIdTokenMock.mockResolvedValue({
      uid: 'phone-staff-uid',
      phone_number: '+12345678900',
      role: 'staff',
    });
    createSessionCookieMock.mockResolvedValue('phone-staff-cookie');

    const response = await POST(createPostRequest('phone-staff-token'));

    expect(response.status).toBe(200);
    expect(createSessionCookieMock).toHaveBeenCalled();
  });

  it('returns 403 for customer role', async () => {
    // Given a valid ID token with role: 'customer'
    verifyIdTokenMock.mockResolvedValue({
      uid: 'customer-uid',
      email: 'customer@example.com',
      role: 'customer',
    });

    // When the session endpoint is called
    const response = await POST(createPostRequest('customer-token'));

    // Then 403 is returned
    expect(response.status).toBe(403);
    expect(createSessionCookieMock).not.toHaveBeenCalled();
  });

  it('returns 403 when no role claim is present', async () => {
    // Given a valid ID token with no role claim
    verifyIdTokenMock.mockResolvedValue({
      uid: 'no-role-uid',
      email: 'unknown@example.com',
    });

    // When the session endpoint is called
    const response = await POST(createPostRequest('no-role-token'));

    // Then 403 is returned
    expect(response.status).toBe(403);
    expect(createSessionCookieMock).not.toHaveBeenCalled();
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

  it('applies pending invite role and asks client to retry token', async () => {
    // Given the email invite flow (pending invite exists)
    verifyIdTokenMock.mockResolvedValue({
      uid: 'invitee-uid',
      email: 'new.staff@rushnrelax.com',
      role: 'customer',
    });
    getPendingUserInviteByEmailMock.mockResolvedValue({
      email: 'new.staff@rushnrelax.com',
      role: 'staff',
      status: 'pending',
    });
    getUserMock.mockResolvedValue({ customClaims: { betaFlag: true } });

    // When the session endpoint is called
    const response = await POST(createPostRequest('invite-token'));
    const body = (await response.json()) as { code?: string };

    // Then 409 CLAIMS_UPDATED_RETRY fires
    expect(response.status).toBe(409);
    expect(body.code).toBe('CLAIMS_UPDATED_RETRY');
    expect(setCustomUserClaimsMock).toHaveBeenCalledWith('invitee-uid', {
      betaFlag: true,
      role: 'staff',
    });
    expect(markPendingUserInviteAcceptedMock).toHaveBeenCalledWith({
      email: 'new.staff@rushnrelax.com',
      acceptedByUid: 'invitee-uid',
    });
    expect(createSessionCookieMock).not.toHaveBeenCalled();
  });

  it('clears the session cookie on delete', () => {
    const response = DELETE();
    const cookie = response.headers.get('Set-Cookie') ?? '';

    expect(response.status).toBe(200);
    expect(cookie).toContain('__session=;');
    expect(cookie).toContain('Max-Age=0');
  });
});
