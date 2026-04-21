import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { requireRoleMock, setCategoryStatusMock, revalidatePathMock } =
  vi.hoisted(() => ({
    requireRoleMock: vi.fn(),
    setCategoryStatusMock: vi.fn().mockResolvedValue(undefined),
    revalidatePathMock: vi.fn(),
  }));

vi.mock('@/lib/admin-auth', () => ({
  requireRole: requireRoleMock,
}));

vi.mock('@/lib/repositories', () => ({
  setCategoryStatus: setCategoryStatusMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

import { toggleCategoryStatus } from '@/app/(admin)/admin/categories/actions';

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

describe('toggleCategoryStatus server action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given an unauthenticated caller', () => {
    it('propagates the redirect thrown by requireRole', async () => {
      stubUnauthorised();

      await expect(toggleCategoryStatus('flower', true)).rejects.toThrow(
        'NEXT_REDIRECT:/admin/login'
      );

      expect(setCategoryStatusMock).not.toHaveBeenCalled();
      expect(revalidatePathMock).not.toHaveBeenCalled();
    });
  });

  describe('given a currently-active category', () => {
    it('calls setCategoryStatus with false (deactivate)', async () => {
      stubAuthorisedActor();

      await toggleCategoryStatus('flower', true);

      expect(setCategoryStatusMock).toHaveBeenCalledOnce();
      expect(setCategoryStatusMock).toHaveBeenCalledWith('flower', false);
    });
  });

  describe('given a currently-inactive category', () => {
    it('calls setCategoryStatus with true (activate)', async () => {
      stubAuthorisedActor();

      await toggleCategoryStatus('flower', false);

      expect(setCategoryStatusMock).toHaveBeenCalledOnce();
      expect(setCategoryStatusMock).toHaveBeenCalledWith('flower', true);
    });
  });

  describe('given a successful toggle', () => {
    it('revalidates the expected paths', async () => {
      stubAuthorisedActor();

      await toggleCategoryStatus('flower', true);

      expect(revalidatePathMock).toHaveBeenCalledWith('/admin/categories');
      expect(revalidatePathMock).toHaveBeenCalledWith('/products');
    });
  });
});
