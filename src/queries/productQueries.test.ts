import { describe, it, expect, vi } from 'vitest';
import { createProductQueries, productKeys } from './productQueries';
import type { ProductRepository } from '@/repositories/ProductRepository';
import type { Product } from '@/types';

describe('productKeys', () => {
  it('should generate all key', () => {
    expect(productKeys.all).toEqual(['products']);
  });

  it('should generate lists key', () => {
    expect(productKeys.lists()).toEqual(['products', 'list']);
  });

  it('should generate list key with categoryId filter', () => {
    expect(productKeys.list({ categoryId: 'flower' })).toEqual([
      'products',
      'list',
      { categoryId: 'flower' },
    ]);
  });

  it('should generate details key', () => {
    expect(productKeys.details()).toEqual(['products', 'detail']);
  });

  it('should generate detail key with category and productId', () => {
    expect(productKeys.detailById('flower', 'prod-123')).toEqual([
      'products',
      'detail',
      'byId',
      'flower',
      'prod-123',
    ]);
  });

  it('should generate detail key by slug for backward compat', () => {
    expect(productKeys.detailBySlug('flower', 'blue-dream')).toEqual([
      'products',
      'detail',
      'bySlug',
      'flower',
      'blue-dream',
    ]);
  });
});

describe('createProductQueries', () => {
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
      tags: ['popular'],
      notes: 'Test note',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockRepository: ProductRepository = {
    getAllProducts: vi.fn().mockResolvedValue(mockProducts),
    getProductsByCategoryId: vi.fn().mockResolvedValue(mockProducts),
    getProductBySlug: vi.fn().mockResolvedValue(mockProducts[0]),
    getProductsBySlugAsGuest: vi.fn(),
    getProductsByCategoryAsGuest: vi.fn(),
    getProductsBySlugAsStaff: vi.fn(),
    getProductsByCategoryAsStaff: vi.fn(),
    getProductsBySlugAsAdmin: vi.fn(),
    getAllProductsAsAdmin: vi.fn(),
    getProductByIdAsGuest: vi.fn().mockResolvedValue(mockProducts[0]),
    getProductByIdAsStaff: vi.fn().mockResolvedValue(mockProducts[0]),
    getProductByIdAsAdmin: vi.fn().mockResolvedValue(mockProducts[0]),
    createProduct: vi.fn().mockResolvedValue('new-product-id'),
    updateProduct: vi.fn().mockResolvedValue(undefined),
    deleteProduct: vi.fn().mockResolvedValue(undefined),
  };

  describe('all query', () => {
    it('should create query configuration for all products', () => {
      const queries = createProductQueries(mockRepository);
      const queryConfig = queries.all();

      expect(queryConfig.queryKey).toEqual(['products', 'list']);
      expect(queryConfig.staleTime).toBe(5 * 60 * 1000);
      expect(queryConfig.gcTime).toBe(10 * 60 * 1000);
      expect(typeof queryConfig.queryFn).toBe('function');
    });

    it('should call repository.getAllProducts when queryFn is invoked', async () => {
      const queries = createProductQueries(mockRepository);
      const queryConfig = queries.all();

      const result = await queryConfig.queryFn?.({ queryKey: queryConfig.queryKey } as any);

      expect(mockRepository.getAllProducts).toHaveBeenCalled();
      expect(result).toEqual(mockProducts);
    });
  });

  describe('byCategoryId query', () => {
    it('should create query configuration for category products', () => {
      const queries = createProductQueries(mockRepository);
      const queryConfig = queries.byCategoryId('flower');

      expect(queryConfig.queryKey).toEqual([
        'products',
        'list',
        { categoryId: 'flower' },
      ]);
      expect(queryConfig.staleTime).toBe(5 * 60 * 1000);
      expect(queryConfig.gcTime).toBe(10 * 60 * 1000);
    });

    it('should call repository.getProductsByCategoryId when queryFn is invoked', async () => {
      const queries = createProductQueries(mockRepository);
      const queryConfig = queries.byCategoryId('edibles');

      const result = await queryConfig.queryFn?.({ queryKey: queryConfig.queryKey } as any);

      expect(mockRepository.getProductsByCategoryId).toHaveBeenCalledWith(
        'edibles'
      );
      expect(result).toEqual(mockProducts);
    });
  });

  describe('bySlug query', () => {
    it('should create query configuration for single product', () => {
      const queries = createProductQueries(mockRepository);
      const queryConfig = queries.bySlug('flower', 'test-flower');

      expect(queryConfig.queryKey).toEqual([
        'products',
        'detail',
        'bySlug',
        'flower',
        'test-flower',
      ]);
      expect(queryConfig.staleTime).toBe(5 * 60 * 1000);
      expect(queryConfig.gcTime).toBe(10 * 60 * 1000);
    });

    it('should call repository.getProductBySlug when queryFn is invoked', async () => {
      const queries = createProductQueries(mockRepository);
      const queryConfig = queries.bySlug('flower', 'blue-dream');

      const result = await queryConfig.queryFn?.({ queryKey: queryConfig.queryKey } as any);

      expect(mockRepository.getProductBySlug).toHaveBeenCalledWith(
        'flower',
        'blue-dream'
      );
      expect(result).toEqual(mockProducts[0]);
    });

    it('should throw error when product not found', async () => {
      const notFoundRepository: ProductRepository = {
        ...mockRepository,
        getProductBySlug: vi.fn().mockResolvedValue(null),
      };

      const queries = createProductQueries(notFoundRepository);
      const queryConfig = queries.bySlug('flower', 'nonexistent');

      await expect(queryConfig.queryFn?.({ queryKey: queryConfig.queryKey } as any)).rejects.toThrow('Product not found');
    });
  });
});
