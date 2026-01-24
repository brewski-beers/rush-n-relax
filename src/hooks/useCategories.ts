import { useSuspenseQuery } from '@tanstack/react-query';
import { categoryQueries } from '@/queries/categoryQueries';
import type { Category } from '@/types';

/**
 * Hook to fetch all active categories using TanStack Query.
 * Uses Suspense for loading states - wrap component in <Suspense> boundary.
 * Throws errors to be caught by ErrorBoundary.
 * 
 * @returns Array of active categories ordered by display order
 */
export function useCategories(): Category[] {
  const { data } = useSuspenseQuery(categoryQueries.active());
  return data;
}

/**
 * Hook to fetch a single category by ID using TanStack Query.
 * Primary hook for category detail pages.
 * Uses Suspense for loading states - wrap component in <Suspense> boundary.
 * Throws errors to be caught by ErrorBoundary when category not found.
 * 
 * @param id - Category ID (Firestore document ID)
 * @returns Category data
 */
export function useCategoryById(id: string): Category {
  const { data } = useSuspenseQuery(categoryQueries.byId(id));
  return data;
}

/**
 * Hook to fetch a single category by slug using TanStack Query.
 * Legacy hook for backward compatibility.
 * Uses Suspense for loading states - wrap component in <Suspense> boundary.
 * Throws errors to be caught by ErrorBoundary when category not found.
 * 
 * @param slug - Category slug (URL-friendly identifier)
 * @returns Category data
 */
export function useCategoryBySlug(slug: string): Category {
  const { data } = useSuspenseQuery(categoryQueries.bySlug(slug));
  return data;
}
