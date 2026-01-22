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

  it('should generate list key with category filter', () => {
    expect(productKeys.list({ category: 'flower' })).toEqual([
      'products',
      'list',
      { category: 'flower' },
    ]);
  });

  it('should generate details key', () => {
    expect(productKeys.details()).toEqual(['products', 'detail']);
  });

  it('should generate detail key with category and slug', () => {
    expect(productKeys.detail('flower', 'blue-dream')).toEqual([
      'products',
      'detail',
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
  ];

  const mockRepository: ProductRepository = {
    getAllProducts: vi.fn().mockResolvedValue(mockProducts),
    getProductsByCategory: vi.fn().mockResolvedValue(mockProducts),
    getProductBySlug: vi.fn().mockResolvedValue(mockProducts[0]),
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

  describe('byCategory query', () => {
    it('should create query configuration for category products', () => {
      const queries = createProductQueries(mockRepository);
      const queryConfig = queries.byCategory('flower');

      expect(queryConfig.queryKey).toEqual([
        'products',
        'list',
        { category: 'flower' },
      ]);
      expect(queryConfig.staleTime).toBe(5 * 60 * 1000);
      expect(queryConfig.gcTime).toBe(10 * 60 * 1000);
    });

    it('should call repository.getProductsByCategory when queryFn is invoked', async () => {
      const queries = createProductQueries(mockRepository);
      const queryConfig = queries.byCategory('edibles');

      const result = await queryConfig.queryFn?.({ queryKey: queryConfig.queryKey } as any);

      expect(mockRepository.getProductsByCategory).toHaveBeenCalledWith(
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
