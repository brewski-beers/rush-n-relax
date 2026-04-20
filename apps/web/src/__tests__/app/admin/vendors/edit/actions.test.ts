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
  upsertVendorMock: vi.fn().mockResolvedValue('acme'),
  getVendorBySlugMock: vi.fn(),
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

import { updateVendor } from '@/app/(admin)/admin/vendors/[slug]/edit/actions';

// ── Helpers ────────────────────────────────────────────────────────────────

function stubAuthorisedActor() {
  requireRoleMock.mockResolvedValue({
    uid: 'owner-uid',
    email: 'owner@rushnrelax.com',
    role: 'owner',
  });
}

function stubExistingVendor() {
  getVendorBySlugMock.mockResolvedValue({
    id: 'acme',
    slug: 'acme',
    name: 'Acme',
    categories: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
  return fd;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('updateVendor server action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubAuthorisedActor();
    redirectMock.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });
  });

  describe('given the vendor does not exist', () => {
    it('returns error: Vendor not found.', async () => {
      getVendorBySlugMock.mockResolvedValue(null);

      const result = await updateVendor(
        'ghost',
        null,
        makeFormData({ name: 'Ghost' })
      );
      expect(result).toEqual({ error: 'Vendor not found.' });
      expect(upsertVendorMock).not.toHaveBeenCalled();
    });
  });

  describe('given missing name', () => {
    it('returns error: Name is required.', async () => {
      stubExistingVendor();

      const result = await updateVendor('acme', null, makeFormData({}));
      expect(result).toEqual({ error: 'Name is required.' });
      expect(upsertVendorMock).not.toHaveBeenCalled();
    });
  });

  describe('given valid update data', () => {
    it('calls upsertVendor with the updated payload preserving slug and isActive', async () => {
      stubExistingVendor();

      await expect(
        updateVendor(
          'acme',
          null,
          makeFormData({ name: 'Acme Updated', categories: 'vapes' })
        )
      ).rejects.toThrow('NEXT_REDIRECT');

      expect(upsertVendorMock).toHaveBeenCalledOnce();
      const [payload] = upsertVendorMock.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(payload.slug).toBe('acme');
      expect(payload.name).toBe('Acme Updated');
      expect(payload.categories).toEqual(['vapes']);
      expect(payload.isActive).toBe(true);
    });

    it('revalidates /admin/vendors before redirecting', async () => {
      stubExistingVendor();

      await expect(
        updateVendor('acme', null, makeFormData({ name: 'Acme' }))
      ).rejects.toThrow('NEXT_REDIRECT');

      expect(revalidatePathMock).toHaveBeenCalledWith('/admin/vendors');
    });
  });
});
