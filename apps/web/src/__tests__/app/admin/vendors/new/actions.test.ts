import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  requireRoleMock,
  upsertVendorMock,
  getVendorBySlugMock,
  revalidatePathMock,
  redirectMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  upsertVendorMock: vi.fn().mockResolvedValue('new-vendor'),
  getVendorBySlugMock: vi.fn().mockResolvedValue(null),
  revalidatePathMock: vi.fn(),
  redirectMock: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('@/lib/admin-auth', () => ({
  requireRole: requireRoleMock,
}));

vi.mock('@/lib/repositories', () => ({
  upsertVendor: upsertVendorMock,
  getVendorBySlug: getVendorBySlugMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

import { createVendor } from '@/app/(admin)/admin/vendors/new/actions';

// ── Helpers ────────────────────────────────────────────────────────────────

function stubAuthorisedActor() {
  requireRoleMock.mockResolvedValue({
    uid: 'owner-uid',
    email: 'owner@rushnrelax.com',
    role: 'owner',
  });
}

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
  return fd;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('createVendor server action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubAuthorisedActor();
    getVendorBySlugMock.mockResolvedValue(null);
    redirectMock.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });
  });

  describe('given missing slug', () => {
    it('returns error: Slug and name are required.', async () => {
      const result = await createVendor(null, makeFormData({ name: 'Acme' }));
      expect(result).toEqual({ error: 'Slug and name are required.' });
      expect(upsertVendorMock).not.toHaveBeenCalled();
    });
  });

  describe('given missing name', () => {
    it('returns error: Slug and name are required.', async () => {
      const result = await createVendor(null, makeFormData({ slug: 'acme' }));
      expect(result).toEqual({ error: 'Slug and name are required.' });
      expect(upsertVendorMock).not.toHaveBeenCalled();
    });
  });

  describe('given a slug with invalid characters', () => {
    it('returns error about slug format', async () => {
      const result = await createVendor(
        null,
        makeFormData({ slug: 'Acme Vendor!', name: 'Acme' })
      );
      expect(result).toEqual({
        error: 'Slug must be lowercase letters, numbers, and hyphens only.',
      });
      expect(upsertVendorMock).not.toHaveBeenCalled();
    });
  });

  describe('given a slug that already exists', () => {
    it('returns error: A vendor with slug "..." already exists.', async () => {
      getVendorBySlugMock.mockResolvedValue({ slug: 'acme', name: 'Acme' });

      const result = await createVendor(
        null,
        makeFormData({ slug: 'acme', name: 'Acme' })
      );
      expect(result).toEqual({
        error: 'A vendor with slug "acme" already exists.',
      });
      expect(upsertVendorMock).not.toHaveBeenCalled();
    });
  });

  describe('given valid slug and name', () => {
    it('calls upsertVendor with the correct payload', async () => {
      await expect(
        createVendor(
          null,
          makeFormData({
            slug: 'acme-vendor',
            name: 'Acme Vendor',
            website: 'https://acme.com',
            categories: 'flower, concentrates',
          })
        )
      ).rejects.toThrow('NEXT_REDIRECT');

      expect(upsertVendorMock).toHaveBeenCalledOnce();
      const [payload] = upsertVendorMock.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(payload.slug).toBe('acme-vendor');
      expect(payload.name).toBe('Acme Vendor');
      expect(payload.website).toBe('https://acme.com');
      expect(payload.categories).toEqual(['flower', 'concentrates']);
      expect(payload.isActive).toBe(true);
    });

    it('revalidates /admin/vendors before redirecting', async () => {
      await expect(
        createVendor(
          null,
          makeFormData({ slug: 'new-vendor', name: 'New Vendor' })
        )
      ).rejects.toThrow('NEXT_REDIRECT');

      expect(revalidatePathMock).toHaveBeenCalledWith('/admin/vendors');
    });
  });
});
