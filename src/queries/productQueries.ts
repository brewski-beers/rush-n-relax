import { queryOptions } from '@tanstack/react-query';
import type { ProductRepository } from '@/repositories/ProductRepository';
import type { ProductCategory } from '@/types';

/**
 * Query key factory for products.
 * Centralizes all query key generation for consistent cache management.
 */
export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters?: { category?: ProductCategory }) =>
    [...productKeys.lists(), filters] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (category: ProductCategory, slug: string) =>
    [...productKeys.details(), category, slug] as const,
};

/**
 * Creates query configurations for product-related queries.
 * Takes a repository instance to maintain dependency injection.
 *
 * @param repository - ProductRepository instance for data fetching
 */
export const createProductQueries = (repository: ProductRepository) => ({
  /**
   * Query configuration for fetching all products
   */
  all: () =>
    queryOptions({
      queryKey: productKeys.lists(),
      queryFn: () => repository.getAllProducts(),
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    }),

  /**
   * Query configuration for fetching products by category
   */
  byCategory: (category: ProductCategory) =>
    queryOptions({
      queryKey: productKeys.list({ category }),
      queryFn: () => repository.getProductsByCategory(category),
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    }),

  /**
   * Query configuration for fetching a single product by slug
   */
  bySlug: (category: ProductCategory, slug: string) =>
    queryOptions({
      queryKey: productKeys.detail(category, slug),
      queryFn: async () => {
        const product = await repository.getProductBySlug(category, slug);
        if (!product) {
          throw new Error('Product not found');
        }
        return product;
      },
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    }),
});

/**
 * Type for the product queries object
 */
export type ProductQueries = ReturnType<typeof createProductQueries>;
