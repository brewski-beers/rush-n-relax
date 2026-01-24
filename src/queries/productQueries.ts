import { queryOptions } from '@tanstack/react-query';
import type { ProductRepository } from '@/repositories/ProductRepository';

/**
 * Query key factory for products.
 * Centralizes all query key generation for consistent cache management.
 * 
 * NOTE: Keys now use product ID (immutable) instead of slug for primary queries.
 * Slug queries kept for backward compatibility.
 */
export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters?: { categoryId?: string }) =>
    [...productKeys.lists(), filters] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detailBySlug: (categoryId: string, slug: string) =>
    [...productKeys.details(), 'bySlug', categoryId, slug] as const,
  detailById: (categoryId: string, productId: string) =>
    [...productKeys.details(), 'byId', categoryId, productId] as const,
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
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    }),

  /**
   * Query configuration for fetching products by category ID
   */
  byCategoryId: (categoryId: string) =>
    queryOptions({
      queryKey: productKeys.list({ categoryId }),
      queryFn: () => repository.getProductsByCategoryId(categoryId),
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    }),

  /**
   * ID-based query for fetching a single product (preferred API)
   */
  byId: (categoryId: string, productId: string) =>
    queryOptions({
      queryKey: productKeys.detailById(categoryId, productId),
      queryFn: async () => {
        const product = await repository.getProductByIdAsGuest(categoryId, productId);
        if (!product) {
          throw new Error('Product not found');
        }
        return product;
      },
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    }),

  /**
   * Slug-based query for fetching a single product (legacy, backward compat)
   */
  bySlug: (categoryId: string, slug: string) =>
    queryOptions({
      queryKey: productKeys.detailBySlug(categoryId, slug),
      queryFn: async () => {
        const product = await repository.getProductBySlug(categoryId, slug);
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
