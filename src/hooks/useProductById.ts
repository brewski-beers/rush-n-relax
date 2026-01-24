import { useSuspenseQuery } from '@tanstack/react-query';
import { productRepository } from '@/repositories/ProductRepository';
import { createProductQueries } from '@/queries/productQueries';
import type { ProductGuest } from '@/types';

const productQueries = createProductQueries(productRepository);

/**
 * Hook to fetch a single product by ID using TanStack Query.
 * Primary hook for product detail pages.
 * Uses Suspense for loading states - wrap component in <Suspense> boundary.
 * Throws errors to be caught by ErrorBoundary when product not found.
 * 
 * @param categoryId - Category ID (required for security/filtering)
 * @param productId - Product ID (Firestore auto-generated, immutable)
 * @returns Product data (guest-projected)
 */
export function useProductById(categoryId: string, productId: string): ProductGuest {
  const { data } = useSuspenseQuery(productQueries.byId(categoryId, productId));
  return data;
}
