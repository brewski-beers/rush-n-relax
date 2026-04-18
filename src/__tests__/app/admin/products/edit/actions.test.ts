import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  requireRoleMock,
  upsertProductMock,
  clearProductFieldsMock,
  getProductBySlugMock,
  listActiveCategoriesMock,
  revalidatePathMock,
  redirectMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  upsertProductMock: vi.fn().mockResolvedValue('test-product'),
  clearProductFieldsMock: vi.fn().mockResolvedValue(undefined),
  getProductBySlugMock: vi.fn(),
  listActiveCategoriesMock: vi.fn().mockResolvedValue([]),
  revalidatePathMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock('@/lib/admin-auth', () => ({
  requireRole: requireRoleMock,
}));

vi.mock('@/lib/repositories', () => ({
  upsertProduct: upsertProductMock,
  clearProductFields: clearProductFieldsMock,
  getProductBySlug: getProductBySlugMock,
  listActiveCategories: listActiveCategoriesMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

import { updateProduct } from '@/app/(admin)/admin/products/[slug]/edit/actions';

// ── Helpers ────────────────────────────────────────────────────────────────

function stubAuthorisedActor() {
  requireRoleMock.mockResolvedValue({
    uid: 'owner-uid',
    email: 'owner@rushnrelax.com',
    role: 'owner',
  });
}

function stubExistingProduct(overrides: Record<string, unknown> = {}) {
  getProductBySlugMock.mockResolvedValue({
    id: 'test-product',
    slug: 'test-product',
    name: 'Original Name',
    category: 'flower',
    description: 'Original description',
    details: 'Original details',
    status: 'active',
    image: undefined,
    images: undefined,
    coaUrl: undefined,
    availableAt: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

function makeFormData(
  overrides: Record<string, string | string[]> = {}
): FormData {
  const fd = new FormData();
  const defaults: Record<string, string | string[]> = {
    name: 'Updated Name',
    category: 'flower',
    description: 'Updated description',
    details: 'Updated details',
    status: 'active',
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

describe('updateProduct server action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listActiveCategoriesMock.mockResolvedValue([
      { slug: 'flower', label: 'Flower', order: 1 },
    ]);
  });

  describe('given a non-existent product slug', () => {
    it('returns product-not-found error', async () => {
      stubAuthorisedActor();
      getProductBySlugMock.mockResolvedValue(null);

      const result = await updateProduct('ghost-product', null, makeFormData());

      expect(result).toEqual({ error: 'Product not found.' });
      expect(upsertProductMock).not.toHaveBeenCalled();
    });
  });

  describe('given missing required fields', () => {
    it('returns a required-fields error when name is absent', async () => {
      stubAuthorisedActor();
      stubExistingProduct();

      const result = await updateProduct(
        'test-product',
        null,
        makeFormData({ name: '' })
      );

      expect(result).toEqual({ error: 'All required fields must be filled.' });
      expect(upsertProductMock).not.toHaveBeenCalled();
    });
  });

  describe('given compliance-hold status in the form', () => {
    it('ignores the status field and proceeds normally', async () => {
      stubAuthorisedActor();
      stubExistingProduct();

      // Status is managed externally via setProductStatus — the edit action
      // ignores any status value submitted via form and uses existing.status.
      const result = await updateProduct(
        'test-product',
        null,
        makeFormData({ status: 'compliance-hold' })
      );

      expect(result).toBeUndefined();
      expect(upsertProductMock).toHaveBeenCalled();
    });
  });

  describe('given an invalid category', () => {
    it('returns invalid-category error', async () => {
      stubAuthorisedActor();
      stubExistingProduct();
      listActiveCategoriesMock.mockResolvedValue([
        { slug: 'edibles', label: 'Edibles', order: 2 },
      ]);

      const result = await updateProduct(
        'test-product',
        null,
        makeFormData({ category: 'flower' })
      );

      expect(result).toEqual({ error: 'Invalid category.' });
    });
  });

  describe('gallery merge fallback', () => {
    it('uses existing.images when no gallery paths are provided in the form', async () => {
      stubAuthorisedActor();
      stubExistingProduct({
        images: ['products/test-product/gallery-0.jpg'],
      });
      redirectMock.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT');
      });

      await expect(
        updateProduct('test-product', null, makeFormData())
      ).rejects.toThrow('NEXT_REDIRECT');

      const [payload] = upsertProductMock.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(payload.images).toEqual(['products/test-product/gallery-0.jpg']);
    });

    it('uses provided gallery paths when they are present in the form', async () => {
      stubAuthorisedActor();
      stubExistingProduct({
        images: ['products/test-product/old-gallery.jpg'],
      });
      redirectMock.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT');
      });

      await expect(
        updateProduct(
          'test-product',
          null,
          makeFormData({
            galleryImagePath_0: 'products/test-product/new-gallery.jpg',
          })
        )
      ).rejects.toThrow('NEXT_REDIRECT');

      const [payload] = upsertProductMock.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(payload.images).toEqual(['products/test-product/new-gallery.jpg']);
    });
  });

  describe('coaUrl preservation', () => {
    it('includes existing coaUrl in the upsert payload', async () => {
      stubAuthorisedActor();
      stubExistingProduct({ coaUrl: 'https://coa.example.com/coa.pdf' });
      redirectMock.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT');
      });

      await expect(
        updateProduct('test-product', null, makeFormData())
      ).rejects.toThrow('NEXT_REDIRECT');

      const [payload] = upsertProductMock.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(payload.coaUrl).toBe('https://coa.example.com/coa.pdf');
    });

    it('omits coaUrl when existing product has no coaUrl', async () => {
      stubAuthorisedActor();
      stubExistingProduct({ coaUrl: undefined });
      redirectMock.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT');
      });

      await expect(
        updateProduct('test-product', null, makeFormData())
      ).rejects.toThrow('NEXT_REDIRECT');

      const [payload] = upsertProductMock.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(payload.coaUrl).toBeUndefined();
    });
  });

  describe('featuredImagePath fallback', () => {
    it('falls back to existing.image when featuredImagePath is absent from form', async () => {
      stubAuthorisedActor();
      stubExistingProduct({ image: 'products/test-product/existing-hero.jpg' });
      redirectMock.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT');
      });

      await expect(
        updateProduct('test-product', null, makeFormData())
      ).rejects.toThrow('NEXT_REDIRECT');

      const [payload] = upsertProductMock.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(payload.image).toBe('products/test-product/existing-hero.jpg');
    });

    it('uses the new featuredImagePath when provided', async () => {
      stubAuthorisedActor();
      stubExistingProduct({ image: 'products/test-product/old-hero.jpg' });
      redirectMock.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT');
      });

      await expect(
        updateProduct(
          'test-product',
          null,
          makeFormData({
            featuredImagePath: 'products/test-product/new-hero.jpg',
          })
        )
      ).rejects.toThrow('NEXT_REDIRECT');

      const [payload] = upsertProductMock.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(payload.image).toBe('products/test-product/new-hero.jpg');
    });
  });

  describe('given a valid payload', () => {
    it('revalidates paths and redirects to /admin/products', async () => {
      stubAuthorisedActor();
      stubExistingProduct();
      redirectMock.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT');
      });

      await expect(
        updateProduct('test-product', null, makeFormData())
      ).rejects.toThrow('NEXT_REDIRECT');

      expect(revalidatePathMock).toHaveBeenCalledWith('/admin/products');
      expect(revalidatePathMock).toHaveBeenCalledWith('/products');
      expect(revalidatePathMock).toHaveBeenCalledWith('/products/test-product');
      expect(redirectMock).toHaveBeenCalledWith('/admin/products');
    });
  });
});
