import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useProductsByCategory from './index';
import type { ProductCategory } from '@/types';

// Mock Firebase
vi.mock('@/firebase', () => ({
  db: {}
}));

const mockGetDocs = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockCollection = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args)
}));

describe('useProductsByCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.mockReturnValue({ name: 'products' });
    mockWhere.mockReturnValue({ type: 'where' });
    mockQuery.mockReturnValue({ type: 'query' });
  });

  it('should return loading state initially', () => {
    mockGetDocs.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useProductsByCategory('flower'));

    expect(result.current.loading).toBe(true);
    expect(result.current.products).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should fetch products for a category successfully', async () => {
    const mockProducts = [
      { id: 'prod1', name: 'Product 1', category: 'flower' },
      { id: 'prod2', name: 'Product 2', category: 'flower' }
    ];

    mockGetDocs.mockResolvedValue({
      forEach: (callback: any) => {
        mockProducts.forEach((prod) => {
          callback({
            id: prod.id,
            data: () => ({ name: prod.name, category: prod.category })
          });
        });
      }
    });

    const { result } = renderHook(() => useProductsByCategory('flower'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.products).toHaveLength(2);
    expect(result.current.products[0].id).toBe('prod1');
    expect(result.current.error).toBeNull();
  });

  it('should return empty array when no products found', async () => {
    mockGetDocs.mockResolvedValue({
      forEach: (callback: any) => {
        // No products
      }
    });

    const { result } = renderHook(() => useProductsByCategory('vapes'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.products).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should handle errors', async () => {
    const mockError = new Error('Firestore error');
    mockGetDocs.mockRejectedValue(mockError);

    const { result } = renderHook(() => useProductsByCategory('edibles'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.products).toEqual([]);
    expect(result.current.error).toEqual(mockError);
  });

  it('should query with correct category parameter', async () => {
    mockGetDocs.mockResolvedValue({
      forEach: () => {}
    });

    renderHook(() => useProductsByCategory('accessories'));

    await waitFor(() => {
      expect(mockWhere).toHaveBeenCalledWith('category', '==', 'accessories');
    });
  });

  it('should refetch when category changes', async () => {
    mockGetDocs.mockResolvedValue({
      forEach: () => {}
    });

    const { rerender } = renderHook(
      ({ category }: { category: ProductCategory }) => useProductsByCategory(category),
      { initialProps: { category: 'flower' as ProductCategory } }
    );

    await waitFor(() => {
      expect(mockGetDocs).toHaveBeenCalledTimes(1);
    });

    rerender({ category: 'edibles' as ProductCategory });

    await waitFor(() => {
      expect(mockGetDocs).toHaveBeenCalledTimes(2);
      expect(mockWhere).toHaveBeenLastCalledWith('category', '==', 'edibles');
    });
  });
});
