import { useSuspenseQuery } from '@tanstack/react-query';
import { productRepository } from '@/repositories/ProductRepository';
import { createProductQueries } from '@/queries/productQueries';
import type { Product } from '@/types';

const productQueries = createProductQueries(productRepository);

/**
 * Hook to fetch a single product by category ID and slug using TanStack Query.
 * Uses Suspense for loading states - wrap component in <Suspense> boundary.
 * Throws errors to be caught by ErrorBoundary when product not found.
 * 
 * @param categoryId - Category ID
 * @param slug - Product slug (URL-friendly identifier)
 * @returns Product data
 */
export function useProductBySlug(categoryId: string, slug: string): Product {
  const { data } = useSuspenseQuery(productQueries.bySlug(categoryId, slug));
  return data;
}
