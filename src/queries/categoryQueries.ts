import { queryOptions } from '@tanstack/react-query';
import { categoryRepository } from '@/repositories/CategoryRepository';

/**
 * Category Query Configurations
 * 
 * Centralized query definitions for category data.
 * Each function returns a queryOptions object for TanStack Query.
 */
export const categoryQueries = {
  /**
   * Query all categories (admin use)
   */
  all: () =>
    queryOptions({
      queryKey: ['categories'],
      queryFn: () => categoryRepository.getAll(),
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: 15 * 60 * 1000,
    }),

  /**
   * Query only active categories (public display)
   */
  active: () =>
    queryOptions({
      queryKey: ['categories', 'active'],
      queryFn: () => categoryRepository.getActive(),
      staleTime: 10 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
    }),

  /**
   * Query category by slug
   */
  bySlug: (slug: string) =>
    queryOptions({
      queryKey: ['categories', 'slug', slug],
      queryFn: async () => {
        const category = await categoryRepository.getBySlug(slug);
        if (!category) {
          throw new Error('Category not found');
        }
        return category;
      },
      staleTime: 15 * 60 * 1000,
      gcTime: 20 * 60 * 1000,
    }),

  /**
   * Query category by ID
   */
  byId: (id: string) =>
    queryOptions({
      queryKey: ['categories', 'id', id],
      queryFn: async () => {
        const category = await categoryRepository.getById(id);
        if (!category) {
          throw new Error('Category not found');
        }
        return category;
      },
      staleTime: 15 * 60 * 1000,
      gcTime: 20 * 60 * 1000,
    }),
};
