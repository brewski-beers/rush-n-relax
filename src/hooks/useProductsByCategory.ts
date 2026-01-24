import { useSuspenseQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { productRepository } from '@/repositories/ProductRepository';
import type { ProductGuest, ProductStaff, ProductAdmin, AnyProduct } from '@/types';

/**
 * Smart hook that returns products for a category based on user role
 * 
 * Guest (unauthenticated): ProductGuest[] (displayPrice only)
 * Customer: ProductGuest[] (displayPrice only)
 * Staff: ProductStaff[] (includes stock, cost)
 * Admin: ProductAdmin[] (full schema)
 * 
 * Automatically handles role-based data projection at the data layer
 */
export function useProductsByCategory(
  categoryId: string
): AnyProduct[] {
  const { user } = useAuth();

  // Guest query
  if (!user || user.role === 'guest' || user.role === 'customer') {
    const { data } = useSuspenseQuery({
      queryKey: ['products', 'guest', 'category', categoryId],
      queryFn: () =>
        productRepository.getProductsByCategoryAsGuest(categoryId),
      staleTime: 5 * 60 * 1000,
    });

    return data as ProductGuest[];
  }

  // Staff query
  if (user.role === 'staff') {
    const { data } = useSuspenseQuery({
      queryKey: ['products', 'staff', 'category', categoryId, user.uid],
      queryFn: () =>
        productRepository.getProductsByCategoryAsStaff(categoryId, user),
      staleTime: 2 * 60 * 1000,
    });

    return data as ProductStaff[];
  }

  // Admin/Manager query
  if (user.role === 'admin' || user.role === 'manager') {
    const { data } = useSuspenseQuery({
      queryKey: ['products', 'admin', 'category', categoryId, user.uid],
      queryFn: () => productRepository.getAllProductsAsAdmin(user),
      staleTime: 1 * 60 * 1000,
    });

    return data as ProductAdmin[];
  }

  throw new Error('Unknown user role');
}

// Default export for backward compatibility
export default useProductsByCategory;
