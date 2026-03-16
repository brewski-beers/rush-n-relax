import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  requireRoleMock,
  upsertProductMock,
  getProductBySlugMock,
  listActiveCategoriesMock,
  revalidatePathMock,
  redirectMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  upsertProductMock: vi.fn().mockResolvedValue('new-product'),
  getProductBySlugMock: vi.fn().mockResolvedValue(null),
  listActiveCategoriesMock: vi.fn().mockResolvedValue([]),
  revalidatePathMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock('@/lib/admin-auth', () => ({
  requireRole: requireRoleMock,
}));

vi.mock('@/lib/repositories', () => ({
  upsertProduct: upsertProductMock,
  getProductBySlug: getProductBySlugMock,
  listActiveCategories: listActiveCategoriesMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

import { createProduct } from '@/app/(admin)/admin/products/new/actions';

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

function makeFormData(
  overrides: Record<string, string | string[]> = {}
): FormData {
  const fd = new FormData();
  const defaults: Record<string, string | string[]> = {
    slug: 'test-product',
    name: 'Test Product',
    category: 'flower',
    description: 'A great product',
    details: 'Some details here',
    federalDeadlineRisk: 'false',
    availableAt: ['oak-ridge'],
  };
  const merged = { ...defaults, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (Array.isArray(value)) {
      for (const v of value) fd.append(key, v);
    } else {
      fd.set(key, value);
    }
  }
  return fd;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('createProduct server action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listActiveCategoriesMock.mockResolvedValue([
      { slug: 'flower', label: 'Flower', order: 1 },
    ]);
  });

  describe('given an unauthenticated caller', () => {
    it('propagates the redirect thrown by requireRole', async () => {
      stubUnauthorised();

      await expect(createProduct(null, makeFormData())).rejects.toThrow(
        'NEXT_REDIRECT:/admin/login'
      );

      expect(upsertProductMock).not.toHaveBeenCalled();
    });
  });

  describe('given missing required fields', () => {
    it('returns a required-fields error when name is absent', async () => {
      stubAuthorisedActor();

      const result = await createProduct(null, makeFormData({ name: '' }));

      expect(result).toEqual({ error: 'All required fields must be filled.' });
      expect(upsertProductMock).not.toHaveBeenCalled();
    });
  });

  describe('given an invalid slug format', () => {
    it('returns a slug-format error for uppercase characters', async () => {
      stubAuthorisedActor();

      const result = await createProduct(
        null,
        makeFormData({ slug: 'Bad Slug!' })
      );

      expect(result).toEqual({
        error: 'Slug must be lowercase letters, numbers, and hyphens only.',
      });
      expect(upsertProductMock).not.toHaveBeenCalled();
    });

    it('returns a slug-format error for spaces', async () => {
      stubAuthorisedActor();

      const result = await createProduct(
        null,
        makeFormData({ slug: 'bad slug' })
      );

      expect(result).toEqual({
        error: 'Slug must be lowercase letters, numbers, and hyphens only.',
      });
    });
  });

  describe('given an invalid category', () => {
    it('returns an invalid-category error when category is not in active list', async () => {
      stubAuthorisedActor();
      listActiveCategoriesMock.mockResolvedValue([
        { slug: 'edibles', label: 'Edibles', order: 2 },
      ]);

      const result = await createProduct(
        null,
        makeFormData({ category: 'flower' })
      );

      expect(result).toEqual({ error: 'Invalid category.' });
      expect(upsertProductMock).not.toHaveBeenCalled();
    });
  });

  describe('given a slug that already exists', () => {
    it('returns a slug-uniqueness error', async () => {
      stubAuthorisedActor();
      getProductBySlugMock.mockResolvedValue({
        id: 'test-product',
        slug: 'test-product',
        name: 'Existing Product',
        status: 'active',
      });

      const result = await createProduct(null, makeFormData());

      expect(result).toEqual({
        error: 'A product with slug "test-product" already exists.',
      });
      expect(upsertProductMock).not.toHaveBeenCalled();
    });
  });

  describe('given a valid payload', () => {
    it('calls upsertProduct with the correct fields', async () => {
      stubAuthorisedActor();
      getProductBySlugMock.mockResolvedValue(null);

      await createProduct(null, makeFormData());

      expect(upsertProductMock).toHaveBeenCalledOnce();
      const [payload] = upsertProductMock.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(payload.slug).toBe('test-product');
      expect(payload.name).toBe('Test Product');
      expect(payload.category).toBe('flower');
      expect(payload.status).toBe('active');
    });

    it('passes featuredImagePath through to upsertProduct as image', async () => {
      stubAuthorisedActor();
      getProductBySlugMock.mockResolvedValue(null);

      await createProduct(
        null,
        makeFormData({ featuredImagePath: 'products/test-product/hero.jpg' })
      );

      const [payload] = upsertProductMock.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(payload.image).toBe('products/test-product/hero.jpg');
    });

    it('passes undefined image when featuredImagePath is absent', async () => {
      stubAuthorisedActor();
      getProductBySlugMock.mockResolvedValue(null);

      await createProduct(null, makeFormData());

      const [payload] = upsertProductMock.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(payload.image).toBeUndefined();
    });

    it('revalidates product paths and redirects to /admin/products', async () => {
      stubAuthorisedActor();
      getProductBySlugMock.mockResolvedValue(null);
      redirectMock.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT');
      });

      await expect(createProduct(null, makeFormData())).rejects.toThrow(
        'NEXT_REDIRECT'
      );

      expect(revalidatePathMock).toHaveBeenCalledWith('/admin/products');
      expect(revalidatePathMock).toHaveBeenCalledWith('/products');
      expect(revalidatePathMock).toHaveBeenCalledWith('/products/test-product');
      expect(redirectMock).toHaveBeenCalledWith('/admin/products');
    });
  });
});
