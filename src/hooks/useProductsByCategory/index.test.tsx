import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useProductsByCategory from './index';
import { RepositoryProvider } from '@/contexts/RepositoryContext';
import type { Product } from '@/types';

// Mock the firebase module
vi.mock('@/firebase', () => ({
  db: {},
}));

// Mock Firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

// Create wrapper with providers
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        throwOnError: true,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <RepositoryProvider>{children}</RepositoryProvider>
      </QueryClientProvider>
    );
  };
}

describe('useProductsByCategory', () => {
  it('should fetch products for a category successfully', async () => {
    const mockProducts: Product[] = [
      {
        id: 'prod1',
        name: 'Product 1',
        slug: 'product-1',
        category: 'flower',
        price: 29.99,
        stock: 10,
        locationId: 'loc1',
        description: 'Test',
        imageUrl: '/test.jpg',
        thcContent: '20%',
        cbdContent: '1%',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const { getDocs } = await import('firebase/firestore');
    vi.mocked(getDocs).mockResolvedValue({
      docs: mockProducts.map((product) => ({
        id: product.id,
        data: () => {
          const { id, ...rest } = product;
          return rest;
        },
      })),
    } as any);

    const { result } = renderHook(() => useProductsByCategory('flower'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current).toHaveLength(1);
      expect(result.current[0].id).toBe('prod1');
    });
  });

  it('should return empty array when no products found', async () => {
    const { getDocs } = await import('firebase/firestore');
    vi.mocked(getDocs).mockResolvedValue({
      docs: [],
    } as any);

    const { result } = renderHook(() => useProductsByCategory('vapes'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current).toEqual([]);
    });
  });
});
