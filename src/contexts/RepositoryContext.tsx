import React, { createContext, useContext, useMemo } from 'react';
import {
  FirestoreProductRepository,
  type ProductRepository,
} from '@/repositories/ProductRepository';
import { createProductQueries, type ProductQueries } from '@/queries/productQueries';

/**
 * Context for providing repository instances throughout the app.
 * Enables dependency injection and makes testing easier.
 */
interface RepositoryContextValue {
  productRepository: ProductRepository;
  productQueries: ProductQueries;
}

const RepositoryContext = createContext<RepositoryContextValue | null>(null);

/**
 * Provider component that instantiates and provides repositories.
 * This is the single source of truth for repository instances.
 */
export function RepositoryProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<RepositoryContextValue>(() => {
    const productRepository = new FirestoreProductRepository();
    const productQueries = createProductQueries(productRepository);

    return {
      productRepository,
      productQueries,
    };
  }, []);

  return (
    <RepositoryContext.Provider value={value}>
      {children}
    </RepositoryContext.Provider>
  );
}

/**
 * Hook to access repository instances from context.
 * Throws error if used outside RepositoryProvider.
 */
export function useRepositories(): RepositoryContextValue {
  const context = useContext(RepositoryContext);
  if (!context) {
    throw new Error('useRepositories must be used within RepositoryProvider');
  }
  return context;
}

/**
 * Hook to access product queries specifically.
 * Convenience wrapper around useRepositories.
 */
export function useProductQueries(): ProductQueries {
  const { productQueries } = useRepositories();
  return productQueries;
}
