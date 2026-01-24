import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { categoryQueries } from '../queries/categoryQueries';
import { productRepository } from '../repositories/ProductRepository';
import { createProductQueries } from '../queries/productQueries';

const productQueries = createProductQueries(productRepository);

/**
 * Prefetch Categories Hook
 * 
 * Prefetches active categories on hover for faster navigation.
 */
export function usePrefetchCategories() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.prefetchQuery(categoryQueries.active());
  }, [queryClient]);
}

/**
 * Prefetch Category Products Hook
 * 
 * Prefetches products for a specific category on hover.
 */
export function usePrefetchCategoryProducts(categoryId: string) {
  const queryClient = useQueryClient();

  return useCallback(() => {
    if (categoryId) {
      queryClient.prefetchQuery(productQueries.byCategoryId(categoryId));
    }
  }, [queryClient, categoryId]);
}

/**
 * Prefetch Product Detail Hook
 * 
 * Prefetches product detail on card hover for instant navigation.
 */
export function usePrefetchProduct(categoryId: string, productSlug: string) {
  const queryClient = useQueryClient();

  return useCallback(() => {
    if (categoryId && productSlug) {
      queryClient.prefetchQuery(productQueries.bySlug(categoryId, productSlug));
    }
  }, [queryClient, categoryId, productSlug]);
}
