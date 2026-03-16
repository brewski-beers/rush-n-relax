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
  getCategoryBySlugMock: vi.fn().mockResolvedValue(null),
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

import { createCategory } from '@/app/(admin)/admin/categories/new/actions';

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
    slug: 'flower',
    label: 'Flower',
    description: 'Premium flower products',
    order: '1',
    isActive: 'true',
  };
  const merged = { ...defaults, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    fd.set(key, value);
  }
  return fd;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('createCategory server action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given order = 0', () => {
    it('returns an order validation error', async () => {
      stubAuthorisedActor();

      const result = await createCategory(null, makeFormData({ order: '0' }));

      expect(result).toEqual({ error: 'Order must be a positive integer.' });
      expect(upsertCategoryMock).not.toHaveBeenCalled();
    });
  });

  describe('given a negative order', () => {
    it('returns an order validation error', async () => {
      stubAuthorisedActor();

      const result = await createCategory(null, makeFormData({ order: '-1' }));

      expect(result).toEqual({ error: 'Order must be a positive integer.' });
      expect(upsertCategoryMock).not.toHaveBeenCalled();
    });
  });

  describe('given a non-numeric order', () => {
    it('returns an order validation error', async () => {
      stubAuthorisedActor();

      const result = await createCategory(null, makeFormData({ order: 'abc' }));

      expect(result).toEqual({ error: 'Order must be a positive integer.' });
      expect(upsertCategoryMock).not.toHaveBeenCalled();
    });
  });

  describe('given an invalid slug format', () => {
    it('returns a slug-format error for spaces', async () => {
      stubAuthorisedActor();

      const result = await createCategory(
        null,
        makeFormData({ slug: 'bad slug' })
      );

      expect(result).toEqual({
        error: 'Slug must be lowercase letters, numbers, and hyphens only.',
      });
      expect(upsertCategoryMock).not.toHaveBeenCalled();
    });
  });

  describe('given a slug that already exists', () => {
    it('returns a slug-uniqueness error', async () => {
      stubAuthorisedActor();
      getCategoryBySlugMock.mockResolvedValue({
        slug: 'flower',
        label: 'Flower',
        order: 1,
        isActive: true,
        description: 'Existing category',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await createCategory(null, makeFormData());

      expect(result).toEqual({
        error: 'A category with slug "flower" already exists.',
      });
      expect(upsertCategoryMock).not.toHaveBeenCalled();
    });
  });

  describe('given missing required fields', () => {
    it('returns a required-fields error when label is absent', async () => {
      stubAuthorisedActor();

      const result = await createCategory(null, makeFormData({ label: '' }));

      expect(result).toEqual({ error: 'All required fields must be filled.' });
    });
  });

  describe('given a valid payload', () => {
    it('calls upsertCategory with correct fields', async () => {
      stubAuthorisedActor();
      getCategoryBySlugMock.mockResolvedValue(null);
      redirectMock.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT');
      });

      await expect(createCategory(null, makeFormData())).rejects.toThrow(
        'NEXT_REDIRECT'
      );

      expect(upsertCategoryMock).toHaveBeenCalledOnce();
      const [payload] = upsertCategoryMock.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(payload.slug).toBe('flower');
      expect(payload.label).toBe('Flower');
      expect(payload.order).toBe(1);
      expect(payload.isActive).toBe(true);
    });

    it('revalidates paths and redirects to /admin/categories', async () => {
      stubAuthorisedActor();
      getCategoryBySlugMock.mockResolvedValue(null);
      redirectMock.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT');
      });

      await expect(createCategory(null, makeFormData())).rejects.toThrow(
        'NEXT_REDIRECT'
      );

      expect(revalidatePathMock).toHaveBeenCalledWith('/admin/categories');
      expect(revalidatePathMock).toHaveBeenCalledWith('/products');
      expect(redirectMock).toHaveBeenCalledWith('/admin/categories');
    });
  });
});
