import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Firestore } from 'firebase/firestore';
import { FirestoreProductRepository } from './ProductRepository';
import type { Product, ProductCategory } from '@/types';

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
      category: 'flower',
      price: 29.99,
      stock: 10,
      locationId: 'loc1',
      description: 'Test description',
      imageUrl: '/test.jpg',
      thcContent: '20%',
      cbdContent: '1%',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '2',
      name: 'Test Edible',
      slug: 'test-edible',
      category: 'edibles',
      price: 19.99,
      stock: 5,
      locationId: 'loc1',
      description: 'Test edible description',
      imageUrl: '/test-edible.jpg',
      thcContent: '10mg',
      cbdContent: '0mg',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {} as Firestore;
    repository = new FirestoreProductRepository(mockDb);
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

  describe('getProductsByCategory', () => {
    it('should fetch products filtered by category', async () => {
      const flowerProducts = mockProducts.filter((p) => p.category === 'flower');
      mockGetDocs.mockResolvedValue({
        docs: flowerProducts.map((product) => ({
          id: product.id,
          data: () => {
            const { id, ...rest } = product;
            return rest;
          },
        })),
      });

      const products = await repository.getProductsByCategory('flower');

      expect(mockCollection).toHaveBeenCalledWith(mockDb, 'products');
      expect(mockWhere).toHaveBeenCalledWith('category', '==', 'flower');
      expect(mockQuery).toHaveBeenCalled();
      expect(mockGetDocs).toHaveBeenCalled();
      expect(products).toHaveLength(1);
      expect(products[0].category).toBe('flower');
    });

    it('should return empty array when no products in category', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const products = await repository.getProductsByCategory('vapes' as ProductCategory);

      expect(products).toEqual([]);
    });

    it('should handle Firestore errors', async () => {
      mockGetDocs.mockRejectedValue(new Error('Query failed'));

      await expect(
        repository.getProductsByCategory('edibles')
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
      expect(mockWhere).toHaveBeenCalledWith('category', '==', 'flower');
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
