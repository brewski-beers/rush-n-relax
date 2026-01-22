import { useSuspenseQuery } from '@tanstack/react-query';
import { useProductQueries } from '@/contexts/RepositoryContext';
import type { Product, ProductCategory } from '@/types';

/**
 * Hook to fetch products filtered by category using TanStack Query.
 * Uses Suspense for loading states - wrap component in <Suspense> boundary.
 * Throws errors to be caught by ErrorBoundary.
 * 
 * @param category - Product category to filter by
 * @returns Array of products in the specified category
 */
export default function useProductsByCategory(category: ProductCategory): Product[] {
  const productQueries = useProductQueries();
  const { data } = useSuspenseQuery(productQueries.byCategory(category));
  return data;
}
