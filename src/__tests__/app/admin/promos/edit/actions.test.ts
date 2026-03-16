import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { requireRoleMock, upsertPromoMock, getPromoBySlugMock, redirectMock } =
  vi.hoisted(() => ({
    requireRoleMock: vi.fn(),
    upsertPromoMock: vi.fn().mockResolvedValue('spring-sale'),
    getPromoBySlugMock: vi.fn(),
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

import { updatePromo } from '@/app/(admin)/admin/promos/[slug]/edit/actions';

// ── Helpers ────────────────────────────────────────────────────────────────

function stubAuthorisedActor() {
  requireRoleMock.mockResolvedValue({
    uid: 'owner-uid',
    email: 'owner@rushnrelax.com',
    role: 'owner',
  });
}

function stubExistingPromo(overrides: Record<string, unknown> = {}) {
  getPromoBySlugMock.mockResolvedValue({
    id: 'spring-sale',
    slug: 'spring-sale',
    name: 'Spring Sale',
    tagline: 'Save big',
    description: 'Big discounts',
    details: 'In-store only',
    cta: 'Shop Now',
    ctaPath: '/products',
    active: true,
    startDate: undefined,
    endDate: undefined,
    image: undefined,
    keywords: undefined,
    locationSlug: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    name: 'Updated Sale',
    tagline: 'Updated tagline',
    description: 'Updated description',
    details: 'Updated details',
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

describe('updatePromo server action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a non-existent promo slug', () => {
    it('returns a promo-not-found error', async () => {
      stubAuthorisedActor();
      getPromoBySlugMock.mockResolvedValue(null);

      const result = await updatePromo('ghost-promo', null, makeFormData());

      expect(result).toEqual({ error: 'Promo not found.' });
      expect(upsertPromoMock).not.toHaveBeenCalled();
    });
  });

  describe('given missing required fields', () => {
    it('returns a required-fields error when name is absent', async () => {
      stubAuthorisedActor();
      stubExistingPromo();

      const result = await updatePromo(
        'spring-sale',
        null,
        makeFormData({ name: '' })
      );

      expect(result).toEqual({ error: 'All required fields must be filled.' });
      expect(upsertPromoMock).not.toHaveBeenCalled();
    });
  });

  describe('given ctaPath that does not start with /', () => {
    it('returns a ctaPath validation error', async () => {
      stubAuthorisedActor();
      stubExistingPromo();

      const result = await updatePromo(
        'spring-sale',
        null,
        makeFormData({ ctaPath: 'https://external.com' })
      );

      expect(result).toEqual({
        error: 'CTA Path must be an internal path starting with /.',
      });
    });
  });

  describe('given existing startDate/endDate preserved when form omits them', () => {
    it('passes existing startDate to upsertPromo when form has none', async () => {
      stubAuthorisedActor();
      stubExistingPromo({
        startDate: '2025-03-01',
        endDate: '2025-03-31',
      });
      redirectMock.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT');
      });

      await expect(
        updatePromo('spring-sale', null, makeFormData())
      ).rejects.toThrow('NEXT_REDIRECT');

      const [payload] = upsertPromoMock.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(payload.startDate).toBe('2025-03-01');
      expect(payload.endDate).toBe('2025-03-31');
    });

    it('omits startDate/endDate when existing promo has none and form has none', async () => {
      stubAuthorisedActor();
      stubExistingPromo({ startDate: undefined, endDate: undefined });
      redirectMock.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT');
      });

      await expect(
        updatePromo('spring-sale', null, makeFormData())
      ).rejects.toThrow('NEXT_REDIRECT');

      const [payload] = upsertPromoMock.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(payload.startDate).toBeUndefined();
      expect(payload.endDate).toBeUndefined();
    });
  });

  describe('given a valid payload', () => {
    it('calls upsertPromo and redirects to /admin/promos', async () => {
      stubAuthorisedActor();
      stubExistingPromo();
      redirectMock.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT');
      });

      await expect(
        updatePromo('spring-sale', null, makeFormData())
      ).rejects.toThrow('NEXT_REDIRECT');

      expect(upsertPromoMock).toHaveBeenCalledOnce();
      expect(redirectMock).toHaveBeenCalledWith('/admin/promos');
    });
  });
});
