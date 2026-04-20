import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  requireRoleMock,
  setProductStatusMock,
  upsertVariantTemplateMock,
  deleteVariantTemplateMock,
  listArchivedProductsMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  setProductStatusMock: vi.fn().mockResolvedValue(undefined),
  upsertVariantTemplateMock: vi.fn().mockResolvedValue('template-id'),
  deleteVariantTemplateMock: vi.fn().mockResolvedValue(undefined),
  listArchivedProductsMock: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  revalidatePathMock: vi.fn(),
}));

vi.mock('@/lib/admin-auth', () => ({
  requireRole: requireRoleMock,
}));

vi.mock('@/lib/repositories', () => ({
  setProductStatus: setProductStatusMock,
  upsertVariantTemplate: upsertVariantTemplateMock,
  deleteVariantTemplate: deleteVariantTemplateMock,
  listArchivedProducts: listArchivedProductsMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  archiveProduct,
  restoreProduct,
  fetchArchivedProductsAction,
  saveVariantTemplateAction,
  deleteVariantTemplateAction,
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

// ── fetchArchivedProductsAction ────────────────────────────────────────────

describe('fetchArchivedProductsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given an unauthenticated caller', () => {
    it('propagates the redirect thrown by requireRole', async () => {
      stubUnauthorised();

      await expect(fetchArchivedProductsAction()).rejects.toThrow(
        'NEXT_REDIRECT:/admin/login'
      );

      expect(listArchivedProductsMock).not.toHaveBeenCalled();
    });
  });

  describe('given an authorised caller', () => {
    it('calls listArchivedProducts and returns the data', async () => {
      stubAuthorisedActor();
      const archived = [
        {
          id: 'old-product',
          slug: 'old-product',
          name: 'Old Product',
          category: 'flower',
          status: 'archived' as const,
          availableAt: [],
        },
      ];
      listArchivedProductsMock.mockResolvedValue({ items: archived, nextCursor: null });

      const result = await fetchArchivedProductsAction();

      expect(listArchivedProductsMock).toHaveBeenCalledOnce();
      expect(result).toEqual(archived);
    });

    it('returns an empty array when no archived products exist', async () => {
      stubAuthorisedActor();
      listArchivedProductsMock.mockResolvedValue({ items: [], nextCursor: null });

      const result = await fetchArchivedProductsAction();

      expect(result).toEqual([]);
    });
  });
});

// ── saveVariantTemplateAction ──────────────────────────────────────────────

describe('saveVariantTemplateAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given an unauthenticated caller', () => {
    it('returns { ok: false } and does not call upsert', async () => {
      stubUnauthorised();

      const result = await saveVariantTemplateAction('flower', 'Flower', {
        groupId: 'g1',
        label: 'Flower',
        combinable: false,
        options: [],
      });

      expect(result).toMatchObject({ ok: false });
      expect(upsertVariantTemplateMock).not.toHaveBeenCalled();
    });
  });

  describe('given an authorised caller with a valid payload', () => {
    it('calls upsertVariantTemplate and returns { ok: true, id }', async () => {
      stubAuthorisedActor();
      upsertVariantTemplateMock.mockResolvedValue('saved-id');

      const group = {
        groupId: 'g1',
        label: 'Weight',
        combinable: false,
        options: [
          { optionId: 'o1', label: '1g' },
          { optionId: 'o2', label: '3.5g' },
        ],
      };
      const result = await saveVariantTemplateAction(
        'flower-weight',
        'Flower (weight)',
        group
      );

      expect(upsertVariantTemplateMock).toHaveBeenCalledWith({
        key: 'flower-weight',
        label: 'Flower (weight)',
        group,
      });
      expect(result).toEqual({ ok: true, id: 'saved-id' });
    });
  });
});

// ── deleteVariantTemplateAction ────────────────────────────────────────────

describe('deleteVariantTemplateAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given an unauthenticated caller', () => {
    it('returns { ok: false } and does not call delete', async () => {
      stubUnauthorised();

      const result = await deleteVariantTemplateAction('tmpl-id');

      expect(result).toMatchObject({ ok: false });
      expect(deleteVariantTemplateMock).not.toHaveBeenCalled();
    });
  });

  describe('given an authorised caller', () => {
    it('calls deleteVariantTemplate with the correct ID and returns { ok: true }', async () => {
      stubAuthorisedActor();

      const result = await deleteVariantTemplateAction('tmpl-id');

      expect(deleteVariantTemplateMock).toHaveBeenCalledWith('tmpl-id');
      expect(result).toEqual({ ok: true });
    });
  });
});
