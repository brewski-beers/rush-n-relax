import { useSuspenseQuery } from '@tanstack/react-query';
import { useProductQueries } from '@/contexts/RepositoryContext';
import type { Product, ProductCategory } from '@/types';

/**
 * Hook to fetch a single product by category and slug using TanStack Query.
 * Uses Suspense for loading states - wrap component in <Suspense> boundary.
 * Throws errors to be caught by ErrorBoundary when product not found.
 * 
 * @param category - Product category
 * @param slug - Product slug (URL-friendly identifier)
 * @returns Product data
 */
export function useProductBySlug(category: ProductCategory, slug: string): Product {
  const productQueries = useProductQueries();
  const { data } = useSuspenseQuery(productQueries.bySlug(category, slug));
  return data;
}
