import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  requireRoleMock,
  upsertCategoryMock,
  getCategoryBySlugMock,
  revalidatePathMock,
  redirectMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  upsertCategoryMock: vi.fn().mockResolvedValue('flower'),
  getCategoryBySlugMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock('@/lib/admin-auth', () => ({
  requireRole: requireRoleMock,
}));

vi.mock('@/lib/repositories', () => ({
  upsertCategory: upsertCategoryMock,
  getCategoryBySlug: getCategoryBySlugMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

import { updateCategory } from '@/app/(admin)/admin/categories/[slug]/edit/actions';

// ── Helpers ────────────────────────────────────────────────────────────────

function stubAuthorisedActor() {
  requireRoleMock.mockResolvedValue({
    uid: 'owner-uid',
    email: 'owner@rushnrelax.com',
    role: 'owner',
  });
}

function stubExistingCategory(overrides: Record<string, unknown> = {}) {
  getCategoryBySlugMock.mockResolvedValue({
    slug: 'flower',
    label: 'Flower',
    description: 'Premium flower',
    order: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    label: 'Updated Flower',
    description: 'Updated description',
    order: '2',
    isActive: 'true',
  };
  const merged = { ...defaults, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    fd.set(key, value);
  }
  return fd;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('updateCategory server action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a non-existent category slug', () => {
    it('returns a not-found error', async () => {
      stubAuthorisedActor();
      getCategoryBySlugMock.mockResolvedValue(null);

      const result = await updateCategory(
        'ghost-category',
        null,
        makeFormData()
      );

      expect(result).toEqual({ error: 'Category not found.' });
      expect(upsertCategoryMock).not.toHaveBeenCalled();
    });
  });

  describe('given order = 0', () => {
    it('returns an order validation error', async () => {
      stubAuthorisedActor();
      stubExistingCategory();

      const result = await updateCategory(
        'flower',
        null,
        makeFormData({ order: '0' })
      );

      expect(result).toEqual({ error: 'Order must be a positive integer.' });
      expect(upsertCategoryMock).not.toHaveBeenCalled();
    });
  });

  describe('given a negative order', () => {
    it('returns an order validation error', async () => {
      stubAuthorisedActor();
      stubExistingCategory();

      const result = await updateCategory(
        'flower',
        null,
        makeFormData({ order: '-5' })
      );

      expect(result).toEqual({ error: 'Order must be a positive integer.' });
      expect(upsertCategoryMock).not.toHaveBeenCalled();
    });
  });

  describe('given missing required fields', () => {
    it('returns a required-fields error when label is absent', async () => {
      stubAuthorisedActor();
      stubExistingCategory();

      const result = await updateCategory(
        'flower',
        null,
        makeFormData({ label: '' })
      );

      expect(result).toEqual({ error: 'All required fields must be filled.' });
    });
  });

  describe('given a valid payload', () => {
    it('calls upsertCategory with the correct fields', async () => {
      stubAuthorisedActor();
      stubExistingCategory();
      redirectMock.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT');
      });

      await expect(
        updateCategory('flower', null, makeFormData())
      ).rejects.toThrow('NEXT_REDIRECT');

      expect(upsertCategoryMock).toHaveBeenCalledOnce();
      const [payload] = upsertCategoryMock.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(payload.slug).toBe('flower');
      expect(payload.label).toBe('Updated Flower');
      expect(payload.order).toBe(2);
    });

    it('revalidates paths and redirects to /admin/categories', async () => {
      stubAuthorisedActor();
      stubExistingCategory();
      redirectMock.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT');
      });

      await expect(
        updateCategory('flower', null, makeFormData())
      ).rejects.toThrow('NEXT_REDIRECT');

      expect(revalidatePathMock).toHaveBeenCalledWith('/admin/categories');
      expect(revalidatePathMock).toHaveBeenCalledWith('/products');
      expect(redirectMock).toHaveBeenCalledWith('/admin/categories');
    });
  });
});
