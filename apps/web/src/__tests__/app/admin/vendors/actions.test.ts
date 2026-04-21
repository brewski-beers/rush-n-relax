import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { requireRoleMock, setVendorActiveMock, revalidatePathMock } = vi.hoisted(
  () => ({
    requireRoleMock: vi.fn(),
    setVendorActiveMock: vi.fn().mockResolvedValue(undefined),
    revalidatePathMock: vi.fn(),
  })
);

vi.mock('@/lib/admin-auth', () => ({
  requireRole: requireRoleMock,
}));

vi.mock('@/lib/repositories', () => ({
  setVendorActive: setVendorActiveMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  archiveVendor,
  restoreVendor,
} from '@/app/(admin)/admin/vendors/actions';

// ── Helpers ────────────────────────────────────────────────────────────────

function stubAuthorisedActor() {
  requireRoleMock.mockResolvedValue({
    uid: 'owner-uid',
    email: 'owner@rushnrelax.com',
    role: 'owner',
  });
}

function stubUnauthorised() {
  requireRoleMock.mockImplementation(() => {
    throw new Error('NEXT_REDIRECT:/admin/login');
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('archiveVendor server action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given an unauthenticated caller', () => {
    it('propagates the redirect without calling setVendorActive', async () => {
      stubUnauthorised();

      await expect(archiveVendor('acme')).rejects.toThrow(
        'NEXT_REDIRECT:/admin/login'
      );
      expect(setVendorActiveMock).not.toHaveBeenCalled();
    });
  });

  describe('given an authorised owner', () => {
    it('calls setVendorActive with isActive: false', async () => {
      stubAuthorisedActor();

      await archiveVendor('acme');

      expect(setVendorActiveMock).toHaveBeenCalledWith('acme', false);
    });

    it('revalidates /admin/vendors', async () => {
      stubAuthorisedActor();

      await archiveVendor('acme');

      expect(revalidatePathMock).toHaveBeenCalledWith('/admin/vendors');
    });
  });
});

describe('restoreVendor server action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given an unauthenticated caller', () => {
    it('propagates the redirect without calling setVendorActive', async () => {
      stubUnauthorised();

      await expect(restoreVendor('acme')).rejects.toThrow(
        'NEXT_REDIRECT:/admin/login'
      );
      expect(setVendorActiveMock).not.toHaveBeenCalled();
    });
  });

  describe('given an authorised owner', () => {
    it('calls setVendorActive with isActive: true', async () => {
      stubAuthorisedActor();

      await restoreVendor('acme');

      expect(setVendorActiveMock).toHaveBeenCalledWith('acme', true);
    });

    it('revalidates /admin/vendors', async () => {
      stubAuthorisedActor();

      await restoreVendor('acme');

      expect(revalidatePathMock).toHaveBeenCalledWith('/admin/vendors');
    });
  });
});
