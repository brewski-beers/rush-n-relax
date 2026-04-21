import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { verifySessionCookieMock, cookiesGetMock } = vi.hoisted(() => {
  const verifySessionCookieMock = vi.fn();
  const cookiesGetMock = vi.fn();
  return { verifySessionCookieMock, cookiesGetMock };
});

vi.mock('@/lib/firebase/admin', () => ({
  getAdminAuth: () => ({
    verifySessionCookie: verifySessionCookieMock,
  }),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: cookiesGetMock,
  })),
}));

// redirect() in Next.js throws a special NEXT_REDIRECT error internally.
// We capture it here as a plain Error so tests can assert against it.
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

import { requireRole, hasAdminSession } from '@/lib/admin-auth';

// ── Helpers ────────────────────────────────────────────────────────────────

function stubSession(sessionCookie: string | undefined) {
  cookiesGetMock.mockReturnValue(
    sessionCookie ? { value: sessionCookie } : undefined
  );
}

function stubVerifiedToken(claims: Record<string, unknown>) {
  verifySessionCookieMock.mockResolvedValue(claims);
}

function stubInvalidToken() {
  verifySessionCookieMock.mockRejectedValue(new Error('Token expired'));
}

// ── requireRole ────────────────────────────────────────────────────────────

describe('requireRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given no session cookie', () => {
    it('redirects to /admin/login', async () => {
      stubSession(undefined);

      await expect(requireRole('owner')).rejects.toThrow(
        'NEXT_REDIRECT:/admin/login'
      );
    });
  });

  describe('given a staff session when owner role is required', () => {
    it('redirects to /admin/login (insufficient role)', async () => {
      stubSession('valid-cookie');
      stubVerifiedToken({
        uid: 'staff-uid',
        email: 'staff@example.com',
        role: 'staff',
      });

      await expect(requireRole('owner')).rejects.toThrow(
        'NEXT_REDIRECT:/admin/login'
      );
    });
  });

  describe('given a valid owner session', () => {
    it('returns AdminActorContext with uid, email, and role', async () => {
      stubSession('valid-cookie');
      stubVerifiedToken({
        uid: 'owner-uid',
        email: 'owner@rushnrelax.com',
        role: 'owner',
      });

      const actor = await requireRole('owner');

      expect(actor).toEqual({
        uid: 'owner-uid',
        email: 'owner@rushnrelax.com',
        role: 'owner',
      });
    });
  });

  describe('given an expired or invalid session cookie', () => {
    it('redirects to /admin/login', async () => {
      stubSession('stale-cookie');
      stubInvalidToken();

      await expect(requireRole('owner')).rejects.toThrow(
        'NEXT_REDIRECT:/admin/login'
      );
    });
  });

  describe('given a storeManager session when staff role is required', () => {
    it('resolves — higher role satisfies lower minimum', async () => {
      stubSession('valid-cookie');
      stubVerifiedToken({
        uid: 'mgr-uid',
        email: 'manager@rushnrelax.com',
        role: 'storeManager',
      });

      const actor = await requireRole('staff');

      expect(actor).toEqual({
        uid: 'mgr-uid',
        email: 'manager@rushnrelax.com',
        role: 'storeManager',
      });
    });
  });

  describe('given a session token with no role claim', () => {
    it('redirects to /admin/login (invalid claim)', async () => {
      stubSession('valid-cookie');
      stubVerifiedToken({ uid: 'uid', email: 'user@example.com' });

      await expect(requireRole('owner')).rejects.toThrow(
        'NEXT_REDIRECT:/admin/login'
      );
    });
  });
});

// ── hasAdminSession ────────────────────────────────────────────────────────

describe('hasAdminSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given no session cookie', () => {
    it('returns false', async () => {
      stubSession(undefined);

      expect(await hasAdminSession()).toBe(false);
    });
  });

  describe('given a valid owner session', () => {
    it('returns true', async () => {
      stubSession('valid-cookie');
      stubVerifiedToken({
        uid: 'owner-uid',
        email: 'owner@rushnrelax.com',
        role: 'owner',
      });

      expect(await hasAdminSession()).toBe(true);
    });
  });

  describe('given a staff session when owner is the minimum role', () => {
    it('returns false', async () => {
      stubSession('valid-cookie');
      stubVerifiedToken({
        uid: 'staff-uid',
        email: 'staff@rushnrelax.com',
        role: 'staff',
      });

      expect(await hasAdminSession('owner')).toBe(false);
    });
  });

  describe('given an invalid/expired cookie', () => {
    it('returns false', async () => {
      stubSession('bad-cookie');
      stubInvalidToken();

      expect(await hasAdminSession()).toBe(false);
    });
  });
});
