import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { requireRoleMock, setProductStatusMock, revalidatePathMock } =
  vi.hoisted(() => ({
    requireRoleMock: vi.fn(),
    setProductStatusMock: vi.fn().mockResolvedValue(undefined),
    revalidatePathMock: vi.fn(),
  }));

vi.mock('@/lib/admin-auth', () => ({
  requireRole: requireRoleMock,
}));

vi.mock('@/lib/repositories', () => ({
  setProductStatus: setProductStatusMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  archiveProduct,
  restoreProduct,
} from '@/app/(admin)/admin/products/actions';

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

describe('archiveProduct server action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given an unauthenticated caller', () => {
    it('propagates the redirect thrown by requireRole', async () => {
      stubUnauthorised();

      await expect(archiveProduct('test-product')).rejects.toThrow(
        'NEXT_REDIRECT:/admin/login'
      );

      expect(setProductStatusMock).not.toHaveBeenCalled();
      expect(revalidatePathMock).not.toHaveBeenCalled();
    });
  });

  describe('given an authorised owner', () => {
    it('calls setProductStatus with "archived"', async () => {
      stubAuthorisedActor();

      await archiveProduct('test-product');

      expect(setProductStatusMock).toHaveBeenCalledOnce();
      expect(setProductStatusMock).toHaveBeenCalledWith(
        'test-product',
        'archived'
      );
    });

    it('revalidates the expected paths', async () => {
      stubAuthorisedActor();

      await archiveProduct('test-product');

      expect(revalidatePathMock).toHaveBeenCalledWith('/admin/products');
      expect(revalidatePathMock).toHaveBeenCalledWith('/products');
      expect(revalidatePathMock).toHaveBeenCalledWith('/products/test-product');
    });
  });
});

describe('restoreProduct server action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given an unauthenticated caller', () => {
    it('propagates the redirect thrown by requireRole', async () => {
      stubUnauthorised();

      await expect(restoreProduct('test-product')).rejects.toThrow(
        'NEXT_REDIRECT:/admin/login'
      );

      expect(setProductStatusMock).not.toHaveBeenCalled();
      expect(revalidatePathMock).not.toHaveBeenCalled();
    });
  });

  describe('given an authorised owner', () => {
    it('calls setProductStatus with "active"', async () => {
      stubAuthorisedActor();

      await restoreProduct('test-product');

      expect(setProductStatusMock).toHaveBeenCalledOnce();
      expect(setProductStatusMock).toHaveBeenCalledWith(
        'test-product',
        'active'
      );
    });

    it('revalidates the expected paths', async () => {
      stubAuthorisedActor();

      await restoreProduct('test-product');

      expect(revalidatePathMock).toHaveBeenCalledWith('/admin/products');
      expect(revalidatePathMock).toHaveBeenCalledWith('/products');
      expect(revalidatePathMock).toHaveBeenCalledWith('/products/test-product');
    });
  });
});
