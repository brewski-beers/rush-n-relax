import { useSuspenseQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { productRepository } from '@/repositories/ProductRepository';
import type { ProductGuest, ProductStaff, ProductAdmin, AnyProduct } from '@/types';

/**
 * Smart hook that returns the correct product schema based on user role
 * 
 * Guest (unauthenticated): ProductGuest (displayPrice only)
 * Customer: ProductGuest (displayPrice only)
 * Staff: ProductStaff (includes stock, cost)
 * Admin: ProductAdmin (full schema including markup, notes)
 * 
 * Automatically handles role-based data projection at the data layer
 */
export function useProduct(
  categoryId: string,
  slug: string
): AnyProduct {
  const { user } = useAuth();

  // Guest query
  if (!user || user.role === 'guest' || user.role === 'customer') {
    const { data } = useSuspenseQuery({
      queryKey: ['products', 'guest', categoryId, slug],
      queryFn: () => productRepository.getProductsBySlugAsGuest(categoryId, slug),
      staleTime: 10 * 60 * 1000,
    });

    if (!data) {
      throw new Error('Product not found');
    }

    return data as ProductGuest;
  }

  // Staff query
  if (user.role === 'staff') {
    const { data } = useSuspenseQuery({
      queryKey: ['products', 'staff', categoryId, slug, user.id],
      queryFn: () =>
        productRepository.getProductsBySlugAsStaff(categoryId, slug, user),
      staleTime: 2 * 60 * 1000,
    });

    if (!data) {
      throw new Error('Product not found');
    }

    return data as ProductStaff;
  }

  // Admin/Manager query
  if (user.role === 'admin' || user.role === 'manager') {
    const { data } = useSuspenseQuery({
      queryKey: ['products', 'admin', categoryId, slug, user.id],
      queryFn: () =>
        productRepository.getProductsBySlugAsAdmin(categoryId, slug, user),
      staleTime: 1 * 60 * 1000,
    });

    if (!data) {
      throw new Error('Product not found');
    }

    return data as ProductAdmin;
  }

  throw new Error('Unknown user role');
}
