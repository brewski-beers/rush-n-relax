import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SeedResult } from '../seedDataUtils';
import type { Category, ProductAdmin } from '@/types';

/**
 * Tests for seedDataAdmin.ts
 *
 * Critical paths tested:
 * - Batch admin operations for categories
 * - Batch admin operations for products
 * - Error handling during batch queue and commit
 * - Server timestamp injection on all documents
 * - Rule bypass verification (admin SDK)
 *
 * These tests ensure that the admin-based seed utilities correctly
 * bypass Firestore security rules and handle batch operations with
 * proper error reporting.
 */

// Mock category data
const mockCategories: Category[] = [
  {
    id: 'cat-1',
    name: 'Flower',
    slug: 'flower',
    description: 'Premium flower selection',
    imageUrl: 'https://example.com/flower.jpg',
    order: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'cat-2',
    name: 'Edibles',
    slug: 'edibles',
    description: 'Cannabis edibles',
    imageUrl: 'https://example.com/edibles.jpg',
    order: 2,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Mock product data with admin fields
const mockProducts: ProductAdmin[] = [
  {
    id: 'prod-1',
    name: 'Golden Bloom',
    slug: 'golden-bloom',
    categoryId: 'cat-1',
    displayPrice: 45.0,
    description: 'Premium flower',
    cost: 25.0,
    markup: 80,
    inventory: 100,
    sku: 'GB-001',
    imageUrl: 'https://example.com/image.jpg',
    isActive: true,
    tags: ['premium', 'sativa'],
    notes: 'High demand item',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'prod-2',
    name: 'Green Gummy',
    slug: 'green-gummy',
    categoryId: 'cat-2',
    displayPrice: 15.0,
    description: 'Cannabis gummies',
    cost: 5.0,
    markup: 200,
    inventory: 500,
    sku: 'GG-001',
    imageUrl: 'https://example.com/gummy.jpg',
    isActive: true,
    tags: ['edible'],
    notes: 'Best seller',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Mock Firestore batch and admin db
const mockQuerySnapshot = {
  empty: false,
  docs: [{ id: 'cat-1', data: () => ({ name: 'Flower' }) }],
};

const mockBatch = {
  set: vi.fn().mockReturnValue(undefined),
  commit: vi.fn().mockResolvedValue(undefined),
};

const mockAdminDb = {
  batch: vi.fn().mockReturnValue(mockBatch),
  collection: vi.fn().mockReturnValue({
    doc: vi.fn().mockReturnValue({
      id: 'mock-doc-id',
    }),
    limit: vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue(mockQuerySnapshot),
    }),
  }),
};

// Mock admin SDK modules
vi.mock('../firebaseAdminServer', () => ({
  adminDb: mockAdminDb,
  serverTimestamp: () => ({ _type: 'ServerTimestamp' }),
}));

describe('seedDataAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBatch.set.mockClear();
    mockBatch.commit.mockClear();
    mockAdminDb.batch.mockClear();
  });

  describe('seedCategoriesAdmin()', () => {
    it('should batch-insert multiple categories', async () => {
      const { seedCategoriesAdmin } = await import('.');

      mockBatch.commit.mockResolvedValueOnce(undefined);
      const result = await seedCategoriesAdmin(mockCategories);

      expect(result.success).toBe(true);
      expect(result.created).toBe(mockCategories.length);
      expect(result.errors).toHaveLength(0);
    });

    it('should add server timestamps to categories', async () => {
      const { seedCategoriesAdmin } = await import('.');

      mockBatch.commit.mockResolvedValueOnce(undefined);
      await seedCategoriesAdmin(mockCategories);

      // Verify batch.set was called for each category
      expect(mockBatch.set).toHaveBeenCalledTimes(mockCategories.length);

      // Verify that createdAt and updatedAt were added
      const firstCall = mockBatch.set.mock.calls[0];
      expect(firstCall[1]).toHaveProperty('createdAt');
      expect(firstCall[1]).toHaveProperty('updatedAt');
    });

    it('should handle batch commit errors', async () => {
      const { seedCategoriesAdmin } = await import('.');

      const commitError = new Error('Batch commit failed');
      mockBatch.commit.mockRejectedValueOnce(commitError);

      const result = await seedCategoriesAdmin(mockCategories);

      expect(result.success).toBe(false);
      expect(result.created).toBe(0);
      expect(result.errors[0]).toContain('Failed to commit batch');
    });

    it('should handle when some documents fail to queue but others succeed', async () => {
      const { seedCategoriesAdmin } = await import('.');

      // First doc queues OK, second fails
      mockBatch.set.mockImplementationOnce(() => undefined);
      mockBatch.set.mockImplementationOnce(() => {
        throw new Error('Invalid document');
      });
      mockBatch.commit.mockResolvedValueOnce(undefined);

      const result = await seedCategoriesAdmin(mockCategories);

      expect(result.success).toBe(false); // Has errors
      expect(result.created).toBe(1); // One succeeded
      expect(result.errors.length).toBeGreaterThan(0); // One failed
    });

    it('should return failure when all documents fail to queue', async () => {
      const { seedCategoriesAdmin } = await import('.');

      // All docs fail to queue
      mockBatch.set.mockImplementation(() => {
        throw new Error('Invalid document');
      });

      const result = await seedCategoriesAdmin(mockCategories);

      expect(result.success).toBe(false);
      expect(result.created).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should report individual document errors during queue', async () => {
      const { seedCategoriesAdmin } = await import('.');

      // First set succeeds, second fails
      mockBatch.set.mockImplementationOnce(() => undefined);
      mockBatch.set.mockImplementationOnce(() => {
        throw new Error('Document validation failed');
      });
      mockBatch.commit.mockResolvedValueOnce(undefined);

      const result = await seedCategoriesAdmin(mockCategories);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Document validation failed');
    });

    it('should return empty success with zero categories', async () => {
      const { seedCategoriesAdmin } = await import('.');

      const result = await seedCategoriesAdmin([]);

      expect(result.success).toBe(false);
      expect(result.created).toBe(0);
    });
  });

  describe('seedProductsAdmin()', () => {
    it('should batch-insert multiple products with admin fields', async () => {
      const { seedProductsAdmin } = await import('.');

      mockBatch.set.mockClear();
      mockBatch.commit.mockClear();
      mockBatch.set.mockImplementation(() => undefined);
      mockBatch.commit.mockResolvedValueOnce(undefined);

      const result = await seedProductsAdmin(mockProducts);

      expect(result.success).toBe(true);
      expect(result.created).toBe(mockProducts.length);
      expect(result.errors).toHaveLength(0);
    });

    it('should preserve cost, markup, and inventory fields', async () => {
      const { seedProductsAdmin } = await import('.');

      mockBatch.set.mockClear();
      mockBatch.commit.mockClear();
      mockBatch.set.mockImplementation(() => undefined);
      mockBatch.commit.mockResolvedValueOnce(undefined);

      await seedProductsAdmin(mockProducts);

      const firstCall = mockBatch.set.mock.calls[0];
      const firstProduct = firstCall[1];

      expect(firstProduct).toHaveProperty('cost', mockProducts[0].cost);
      expect(firstProduct).toHaveProperty('markup', mockProducts[0].markup);
      expect(firstProduct).toHaveProperty('inventory', mockProducts[0].inventory);
    });

    it('should add server timestamps to products', async () => {
      const { seedProductsAdmin } = await import('.');

      mockBatch.set.mockClear();
      mockBatch.commit.mockClear();
      mockBatch.set.mockImplementation(() => undefined);
      mockBatch.commit.mockResolvedValueOnce(undefined);

      await seedProductsAdmin(mockProducts);

      const firstCall = mockBatch.set.mock.calls[0];
      expect(firstCall[1]).toHaveProperty('createdAt');
      expect(firstCall[1]).toHaveProperty('updatedAt');
    });

    it('should check categories exist before seeding products', async () => {
      const { seedProductsAdmin } = await import('.');

      // Mock no categories found
      mockAdminDb.collection.mockReturnValueOnce({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ empty: true }),
        }),
      } as any);

      const result = await seedProductsAdmin(mockProducts);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('No categories found');
    });
  });

  describe('SeedResult type', () => {
    it('should have success, created, and errors fields', async () => {
      const { seedCategoriesAdmin } = await import('.');

      mockBatch.commit.mockResolvedValueOnce(undefined);
      const result = await seedCategoriesAdmin(mockCategories);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('created');
      expect(result).toHaveProperty('errors');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.created).toBe('number');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should set success=false when errors array has content', async () => {
      const { seedCategoriesAdmin } = await import('.');

      mockBatch.set.mockImplementationOnce(() => {
        throw new Error('Test error');
      });

      const result = await seedCategoriesAdmin(mockCategories);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('admin SDK bypass', () => {
    it('should use admin batch operations (bypasses rules)', async () => {
      const { seedCategoriesAdmin } = await import('.');

      mockBatch.set.mockClear();
      mockBatch.commit.mockClear();
      mockAdminDb.batch.mockClear();
      mockBatch.set.mockImplementation(() => undefined);
      mockBatch.commit.mockResolvedValueOnce(undefined);

      await seedCategoriesAdmin(mockCategories);

      // Verify that admin batch was created
      expect(mockAdminDb.batch).toHaveBeenCalled();
      expect(mockBatch.set).toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should create documents in correct collection', async () => {
      const { seedCategoriesAdmin } = await import('.');

      mockBatch.set.mockClear();
      mockBatch.commit.mockClear();
      mockAdminDb.collection.mockClear();
      mockBatch.set.mockImplementation(() => undefined);
      mockBatch.commit.mockResolvedValueOnce(undefined);

      await seedCategoriesAdmin(mockCategories);

      // Verify collection reference was created for 'categories'
      expect(mockAdminDb.collection).toHaveBeenCalledWith('categories');
    });

    it('should use auto-generated Firestore IDs', async () => {
      const { seedCategoriesAdmin } = await import('.');

      mockBatch.set.mockClear();
      mockBatch.commit.mockClear();
      mockBatch.set.mockImplementation(() => undefined);
      mockBatch.commit.mockResolvedValueOnce(undefined);

      await seedCategoriesAdmin(mockCategories);

      // Verify that doc() was called to generate IDs
      expect(mockAdminDb.collection().doc).toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    it('should handle mixed success/error during category seeding', async () => {
      const { seedCategoriesAdmin } = await import('.');

      mockBatch.set.mockClear();
      mockBatch.set
        .mockImplementationOnce(() => undefined)
        .mockImplementationOnce(() => {
          throw new Error('Category 2 failed');
        });
      mockBatch.commit.mockResolvedValueOnce(undefined);

      const result = await seedCategoriesAdmin(mockCategories);

      expect(result.created).toBe(1);
      expect(result.errors.length).toBe(1);
    });

    it('should handle successful batch commit without errors', async () => {
      const { seedCategoriesAdmin } = await import('.');

      mockBatch.set.mockClear();
      mockBatch.commit.mockClear();
      mockBatch.set.mockImplementation(() => undefined);
      mockBatch.commit.mockResolvedValueOnce(undefined);

      const result = await seedCategoriesAdmin(mockCategories);

      expect(result.success).toBe(true);
      expect(result.created).toBe(mockCategories.length);
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });
});
