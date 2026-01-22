import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProductBySlug } from './index';
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

describe('useProductBySlug', () => {
  it('should fetch a single product by category and slug', async () => {
    const mockProduct: Product = {
      id: 'prod1',
      name: 'Blue Dream',
      slug: 'blue-dream',
      category: 'flower',
      price: 35.99,
      stock: 15,
      locationId: 'loc1',
      description: 'A sweet strain',
      imageUrl: '/blue-dream.jpg',
      thcContent: '22%',
      cbdContent: '2%',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { getDocs } = await import('firebase/firestore');
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        {
          id: mockProduct.id,
          data: () => {
            const { id, ...rest } = mockProduct;
            return rest;
          },
        },
      ],
      empty: false,
    } as any);

    const { result } = renderHook(
      () => useProductBySlug('flower', 'blue-dream'),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.id).toBe('prod1');
      expect(result.current.name).toBe('Blue Dream');
    });
  });

  // Note: Error handling is now done via ErrorBoundary at the layout level,
  // so testing error states requires ErrorBoundary integration testing
});
