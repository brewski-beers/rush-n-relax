import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Firestore } from 'firebase/firestore';
import { FirestoreProductRepository } from './ProductRepository';
import type { Product } from '@/types';

const mockDb = {} as Firestore;

vi.mock('@/firebase', () => ({
  getFirestore$: () => mockDb,
}));

// Mock Firestore functions
const mockGetDocs = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore');
  return {
    ...actual,
    collection: (...args: unknown[]) => mockCollection(...args),
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
    query: (...args: unknown[]) => mockQuery(...args),
    where: (...args: unknown[]) => mockWhere(...args),
  };
});

describe('FirestoreProductRepository', () => {
  let repository: FirestoreProductRepository;
  let mockDb: Firestore;

  const mockProducts: Product[] = [
    {
      id: '1',
      name: 'Test Flower',
      slug: 'test-flower',
      categoryId: 'flower',
      isActive: true,
      displayPrice: 29.99,
      cost: 18.00,
      markup: 66.61,
      inventory: 10,
      sku: 'TF-001',
      description: 'Test description',
      imageUrl: '/test.jpg',
      thcContent: '20%',
      cbdContent: '1%',
      tags: ['popular', 'sativa'],
      notes: 'Popular strain',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '2',
      name: 'Test Edible',
      slug: 'test-edible',
      categoryId: 'edibles',
      isActive: true,
      displayPrice: 19.99,
      cost: 12.00,
      markup: 66.58,
      inventory: 5,
      sku: 'TE-001',
      description: 'Test edible description',
      imageUrl: '/test-edible.jpg',
      thcContent: '10mg',
      cbdContent: '0mg',
      tags: ['edible', 'gummy'],
      notes: 'Lab tested',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {} as Firestore;
    repository = new FirestoreProductRepository();
    mockCollection.mockReturnValue('mock-collection');
    mockWhere.mockReturnValue('mock-where-clause');
    mockQuery.mockReturnValue('mock-query');
  });

  describe('getAllProducts', () => {
    it('should fetch all products from Firestore', async () => {
      mockGetDocs.mockResolvedValue({
        docs: mockProducts.map((product) => ({
          id: product.id,
          data: () => {
            const { id, ...rest } = product;
            return rest;
          },
        })),
      });

      const products = await repository.getAllProducts();

      expect(mockCollection).toHaveBeenCalledWith(mockDb, 'products');
      expect(mockGetDocs).toHaveBeenCalled();
      expect(products).toHaveLength(2);
      expect(products[0]).toEqual(mockProducts[0]);
    });

    it('should return empty array when no products exist', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const products = await repository.getAllProducts();

      expect(products).toEqual([]);
    });

    it('should handle Firestore errors', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firestore error'));

      await expect(repository.getAllProducts()).rejects.toThrow(
        'Firestore error'
      );
    });
  });

  describe('getProductsByCategoryId', () => {
    it('should fetch products filtered by category', async () => {
      const flowerProducts = mockProducts.filter((p) => p.categoryId === 'flower');
      mockGetDocs.mockResolvedValue({
        docs: flowerProducts.map((product) => ({
          id: product.id,
          data: () => {
            const { id, ...rest } = product;
            return rest;
          },
        })),
      });

      const products = await repository.getProductsByCategoryId('flower');

      expect(mockCollection).toHaveBeenCalledWith(mockDb, 'products');
      expect(mockWhere).toHaveBeenCalledWith('categoryId', '==', 'flower');
      expect(mockQuery).toHaveBeenCalled();
      expect(mockGetDocs).toHaveBeenCalled();
      expect(products).toHaveLength(1);
      expect(products[0].categoryId).toBe('flower');
    });

    it('should return empty array when no products in category', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const products = await repository.getProductsByCategoryId('vapes');

      expect(products).toEqual([]);
    });

    it('should handle Firestore errors', async () => {
      mockGetDocs.mockRejectedValue(new Error('Query failed'));

      await expect(
        repository.getProductsByCategoryId('edibles')
      ).rejects.toThrow('Query failed');
    });
  });

  describe('getProductBySlug', () => {
    it('should fetch a single product by category and slug', async () => {
      const targetProduct = mockProducts[0];
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: targetProduct.id,
            data: () => {
              const { id, ...rest } = targetProduct;
              return rest;
            },
          },
        ],
        empty: false,
      });

      const product = await repository.getProductBySlug('flower', 'test-flower');

      expect(mockCollection).toHaveBeenCalledWith(mockDb, 'products');
      expect(mockWhere).toHaveBeenCalledWith('categoryId', '==', 'flower');
      expect(mockWhere).toHaveBeenCalledWith('slug', '==', 'test-flower');
      expect(mockQuery).toHaveBeenCalled();
      expect(product).toEqual(targetProduct);
    });

    it('should return null when product not found', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [],
        empty: true,
      });

      const product = await repository.getProductBySlug('flower', 'nonexistent');

      expect(product).toBeNull();
    });

    it('should return first result when multiple products match', async () => {
      const targetProduct = mockProducts[0];
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: targetProduct.id,
            data: () => {
              const { id, ...rest } = targetProduct;
              return rest;
            },
          },
          {
            id: '999',
            data: () => ({ name: 'Duplicate' }),
          },
        ],
        empty: false,
      });

      const product = await repository.getProductBySlug('flower', 'test-flower');

      expect(product?.id).toBe(targetProduct.id);
    });

    it('should handle Firestore errors', async () => {
      mockGetDocs.mockRejectedValue(new Error('Network error'));

      await expect(
        repository.getProductBySlug('flower', 'test-flower')
      ).rejects.toThrow('Network error');
    });
  });
});
