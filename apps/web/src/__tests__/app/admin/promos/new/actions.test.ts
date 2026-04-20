import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { requireRoleMock, upsertPromoMock, getPromoBySlugMock, redirectMock } =
  vi.hoisted(() => ({
    requireRoleMock: vi.fn(),
    upsertPromoMock: vi.fn().mockResolvedValue('spring-sale'),
    getPromoBySlugMock: vi.fn().mockResolvedValue(null),
    redirectMock: vi.fn(),
  }));

vi.mock('@/lib/admin-auth', () => ({
  requireRole: requireRoleMock,
}));

vi.mock('@/lib/repositories', () => ({
  upsertPromo: upsertPromoMock,
  getPromoBySlug: getPromoBySlugMock,
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

import { createPromo } from '@/app/(admin)/admin/promos/new/actions';

// ── Helpers ────────────────────────────────────────────────────────────────

function stubAuthorisedActor() {
  requireRoleMock.mockResolvedValue({
    uid: 'owner-uid',
    email: 'owner@rushnrelax.com',
    role: 'owner',
  });
}

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    slug: 'spring-sale',
    name: 'Spring Sale',
    tagline: 'Save big this spring',
    description: 'Big discounts',
    details: 'In-store only',
    cta: 'Shop Now',
    ctaPath: '/products',
    active: 'true',
  };
  const merged = { ...defaults, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    fd.set(key, value);
  }
  return fd;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('createPromo server action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given missing required fields', () => {
    it('returns a required-fields error when name is absent', async () => {
      stubAuthorisedActor();

      const result = await createPromo(null, makeFormData({ name: '' }));

      expect(result).toEqual({ error: 'All required fields must be filled.' });
      expect(upsertPromoMock).not.toHaveBeenCalled();
    });

    it('returns a required-fields error when ctaPath is absent', async () => {
      stubAuthorisedActor();

      const result = await createPromo(null, makeFormData({ ctaPath: '' }));

      expect(result).toEqual({ error: 'All required fields must be filled.' });
      expect(upsertPromoMock).not.toHaveBeenCalled();
    });
  });

  describe('given an invalid slug format', () => {
    it('returns a slug-format error for spaces', async () => {
      stubAuthorisedActor();

      const result = await createPromo(
        null,
        makeFormData({ slug: 'spring sale' })
      );

      expect(result).toEqual({
        error: 'Slug must be lowercase letters, numbers, and hyphens only.',
      });
      expect(upsertPromoMock).not.toHaveBeenCalled();
    });
  });

  describe('given ctaPath that does not start with /', () => {
    it('returns a ctaPath validation error', async () => {
      stubAuthorisedActor();

      const result = await createPromo(
        null,
        makeFormData({ ctaPath: 'https://external.com' })
      );

      expect(result).toEqual({
        error: 'CTA Path must be an internal path starting with /.',
      });
      expect(upsertPromoMock).not.toHaveBeenCalled();
    });
  });

  describe('given a slug that already exists', () => {
    it('returns a slug-uniqueness error', async () => {
      stubAuthorisedActor();
      getPromoBySlugMock.mockResolvedValue({
        id: 'spring-sale',
        slug: 'spring-sale',
        name: 'Existing Promo',
      });

      const result = await createPromo(null, makeFormData());

      expect(result).toEqual({
        error: 'A promo with slug "spring-sale" already exists.',
      });
      expect(upsertPromoMock).not.toHaveBeenCalled();
    });
  });

  describe('given a valid payload', () => {
    it('calls upsertPromo and redirects to /admin/promos', async () => {
      stubAuthorisedActor();
      getPromoBySlugMock.mockResolvedValue(null);
      redirectMock.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT');
      });

      await expect(createPromo(null, makeFormData())).rejects.toThrow(
        'NEXT_REDIRECT'
      );

      expect(upsertPromoMock).toHaveBeenCalledOnce();
      expect(redirectMock).toHaveBeenCalledWith('/admin/promos');
    });

    it('passes all core fields to upsertPromo', async () => {
      stubAuthorisedActor();
      getPromoBySlugMock.mockResolvedValue(null);
      redirectMock.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT');
      });

      await expect(createPromo(null, makeFormData())).rejects.toThrow(
        'NEXT_REDIRECT'
      );

      const [payload] = upsertPromoMock.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(payload.slug).toBe('spring-sale');
      expect(payload.name).toBe('Spring Sale');
      expect(payload.ctaPath).toBe('/products');
      expect(payload.active).toBe(true);
    });
  });
});
