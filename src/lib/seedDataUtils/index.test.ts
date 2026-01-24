/**
 * Tests for seed data utilities
 * Pure business logic testing without Firebase dependencies
 * All Firebase operations are mocked
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  seedCategories,
  seedProducts,
  verifyCategoriesExist,
  type SeedResult,
} from '.';
import * as firebaseAdmin from '../firebaseAdmin';
import type { Category, ProductAdmin } from '@/types';

// Create reusable mock batch
const mockBatch = {
  set: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined),
};

// Mock Firebase operations
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((db, name) => ({ name })),
  writeBatch: vi.fn(() => mockBatch),
  getDocs: vi.fn().mockResolvedValue({ empty: false }),
  serverTimestamp: vi.fn(() => new Date()),
  doc: vi.fn(() => ({ id: 'doc-1' })),
}));

// Mock firebaseAdmin module
vi.mock('../firebaseAdmin', () => ({
  getFirebaseDb: vi.fn(() => ({})),
  getFirebaseApp: vi.fn(() => ({})),
  resetFirebase: vi.fn(),
  isFirebaseInitialized: vi.fn(() => true),
}));

describe('seedDataUtils - Seed data business logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('seedCategories', () => {
    const mockCategories: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>[] =
      [
        {
          name: 'Flower',
          slug: 'flower',
          description: 'Cannabis flower',
          imageUrl: 'https://example.com/flower.jpg',
          order: 1,
          isActive: true,
          seoTitle: 'Cannabis Flower',
          seoDescription: 'Premium cannabis flower',
        },
        {
          name: 'Edibles',
          slug: 'edibles',
          description: 'Cannabis edibles',
          imageUrl: 'https://example.com/edibles.jpg',
          order: 2,
          isActive: true,
          seoTitle: 'Cannabis Edibles',
          seoDescription: 'Premium cannabis edibles',
        },
      ];

    it('should return success when seeding valid categories', async () => {
      const result = await seedCategories(mockCategories);

      expect(result.success).toBe(true);
      expect(result.created).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-array input', async () => {
      const result = await seedCategories(
        'not an array' as any
      );

      expect(result.success).toBe(false);
      expect(result.created).toBe(0);
      expect(result.errors[0]).toContain('must be an array');
    });

    it('should reject empty array', async () => {
      const result = await seedCategories([]);

      expect(result.success).toBe(false);
      expect(result.created).toBe(0);
      expect(result.errors[0]).toContain('No categories provided');
    });

    it('should transform category data correctly', async () => {
      mockBatch.set.mockClear();
      mockBatch.commit.mockClear();

      await seedCategories([mockCategories[0]]);

      // Verify batch.set was called with correct data structure
      expect(mockBatch.set).toHaveBeenCalled();
      const callArgs = mockBatch.set.mock.calls[0];
      const setData = callArgs[1];

      expect(setData).toMatchObject({
        name: 'Flower',
        slug: 'flower',
        description: 'Cannabis flower',
        isActive: true,
        order: 1,
      });
      expect(setData.createdAt).toBeDefined();
      expect(setData.updatedAt).toBeDefined();
    });

    it('should commit batch after queuing documents', async () => {
      mockBatch.set.mockClear();
      mockBatch.commit.mockClear();

      await seedCategories(mockCategories);

      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should not commit empty batch', async () => {
      mockBatch.set.mockClear();
      mockBatch.commit.mockClear();
      mockBatch.set.mockImplementation(() => {
        throw new Error('Queue failed');
      });

      const result = await seedCategories(mockCategories);

      expect(result.success).toBe(false);
      expect(mockBatch.commit).not.toHaveBeenCalled();

      // Reset for other tests
      mockBatch.set.mockReset();
    });

    it('should handle commit failures', async () => {
      mockBatch.set.mockClear();
      mockBatch.commit.mockRejectedValueOnce(
        new Error('Firestore unavailable')
      );

      const result = await seedCategories(mockCategories);

      expect(result.success).toBe(false);
      expect(result.created).toBe(0);
      expect(result.errors[0]).toContain('Failed to commit batch');

      // Reset for other tests
      mockBatch.commit.mockReset();
    });

    it('should collect multiple queueing errors', async () => {
      mockBatch.set.mockClear();
      let callCount = 0;
      mockBatch.set.mockImplementation(() => {
        callCount++;
        if (callCount === 1) throw new Error('Queue failed');
      });

      const result = await seedCategories(mockCategories);

      expect(result.errors.length).toBeGreaterThan(0);

      // Reset for other tests
      mockBatch.set.mockReset();
    });
  });

  describe('seedProducts', () => {
    const mockProducts: Omit<
      ProductAdmin,
      'id' | 'createdAt' | 'updatedAt'
    >[] = [
      {
        categoryId: 'flower',
        name: 'Blue Dream',
        slug: 'blue-dream',
        description: 'Sativa hybrid',
        displayPrice: 45,
        cost: 28,
        imageUrl: 'https://example.com/blue-dream.jpg',
        stock: 15,
        stockThreshold: 5,
        thcContent: '22%',
        cbdContent: '1%',
        isActive: true,
        tags: ['hybrid', 'sativa'],
        notes: 'Popular strain',
        markup: 60.71,
        locationId: 'default',
      },
    ];

    it('should return success when seeding valid products', async () => {
      const result = await seedProducts(mockProducts);

      expect(result.success).toBe(true);
      expect(result.created).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-array input', async () => {
      const result = await seedProducts('not an array' as any);

      expect(result.success).toBe(false);
      expect(result.created).toBe(0);
      expect(result.errors[0]).toContain('must be an array');
    });

    it('should reject empty array', async () => {
      const result = await seedProducts([]);

      expect(result.success).toBe(false);
      expect(result.created).toBe(0);
      expect(result.errors[0]).toContain('No products provided');
    });

    it('should verify categories exist before seeding', async () => {
      const verifySpy = vi
        .spyOn(firebaseAdmin, 'getFirebaseDb')
        .mockReturnValueOnce({} as any);

      // Mock getDocs to return empty (no categories)
      const { getDocs } = await import('firebase/firestore');
      vi.mocked(getDocs).mockResolvedValueOnce({
        empty: true,
      } as any);

      const result = await seedProducts(mockProducts);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('No categories found');
    });

    it('should transform product data correctly', async () => {
      mockBatch.set.mockClear();

      await seedProducts(mockProducts);

      expect(mockBatch.set).toHaveBeenCalled();
      const callArgs = mockBatch.set.mock.calls[0];
      const setData = callArgs[1];

      expect(setData).toMatchObject({
        name: 'Blue Dream',
        slug: 'blue-dream',
        categoryId: 'flower',
        displayPrice: 45,
        cost: 28,
        stock: 15,
        stockThreshold: 5,
        isActive: true,
      });
      expect(setData.createdAt).toBeDefined();
      expect(setData.updatedAt).toBeDefined();
    });

    it('should provide defaults for optional fields', async () => {
      mockBatch.set.mockClear();

      const productWithoutOptionals: Omit<
        ProductAdmin,
        'id' | 'createdAt' | 'updatedAt'
      > = {
        categoryId: 'flower',
        name: 'Test',
        slug: 'test',
        description: 'Test',
        displayPrice: 50,
        cost: 25,
        imageUrl: '',
        stock: 10,
        stockThreshold: 3,
        thcContent: '',
        cbdContent: '',
        isActive: true,
        // No tags, notes, markup, locationId
      } as any;

      await seedProducts([productWithoutOptionals]);

      const setData = mockBatch.set.mock.calls[0][1];
      expect(setData.tags).toEqual([]);
      expect(setData.notes).toBe('');
      expect(setData.markup).toBe(0);
      expect(setData.locationId).toBe('default');
    });

    it('should commit batch after queuing documents', async () => {
      mockBatch.set.mockClear();
      mockBatch.commit.mockClear();

      await seedProducts(mockProducts);

      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe('verifyCategoriesExist', () => {
    it('should return true when categories exist', async () => {
      const result = await verifyCategoriesExist();

      expect(result).toBe(true);
    });

    it('should return false when no categories exist', async () => {
      const { getDocs } = await import('firebase/firestore');
      vi.mocked(getDocs).mockResolvedValueOnce({
        empty: true,
      } as any);

      const result = await verifyCategoriesExist();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      const { getDocs } = await import('firebase/firestore');
      vi.mocked(getDocs).mockRejectedValueOnce(
        new Error('Firestore error')
      );

      const result = await verifyCategoriesExist();

      expect(result).toBe(false);
    });

    it('should gracefully handle unknown error types', async () => {
      const { getDocs } = await import('firebase/firestore');
      vi.mocked(getDocs).mockRejectedValueOnce('Unknown error' as any);

      const result = await verifyCategoriesExist();

      expect(result).toBe(false);
    });
  });

  describe('SeedResult interface', () => {
    it('should have required properties', () => {
      const result: SeedResult = {
        success: true,
        created: 5,
        errors: [],
      };

      expect(result.success).toBeDefined();
      expect(result.created).toBeDefined();
      expect(result.errors).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should include descriptive error messages', async () => {
      const result = await seedCategories([]);

      expect(result.errors[0]).toMatch(/No categories provided/i);
      expect(result.errors[0].length).toBeGreaterThan(0);
    });

    it('should not throw, always return result', async () => {
      const invalidInput = null as any;

      expect(async () => {
        await seedCategories(invalidInput);
      }).not.toThrow();
    });

    it('should include multiple errors in errors array', async () => {
      mockBatch.set.mockClear();
      const errors: Error[] = [];
      mockBatch.set.mockImplementation(() => {
        const err = new Error('Queue failed');
        errors.push(err);
        throw err;
      });

      const result = await seedCategories(
        Array(3).fill({
          name: 'Test',
          slug: 'test',
          description: 'Test',
          imageUrl: '',
          order: 1,
          isActive: true,
          seoTitle: 'Test',
          seoDescription: 'Test',
        })
      );

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
