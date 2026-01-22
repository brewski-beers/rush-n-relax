import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useProducts } from '../../hooks/useProducts';
import * as firebase from 'firebase/firestore';

// Mock firebase/firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
}));

// Mock firebase module
vi.mock('../../firebase', () => ({
  db: {},
}));

describe('useProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('initially returns loading state', () => {
    vi.mocked(firebase.getDocs).mockImplementation(() => new Promise(() => {}));
    
    const { result } = renderHook(() => useProducts());
    
    expect(result.current.loading).toBe(true);
    expect(result.current.products).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  test('fetches products successfully', async () => {
    const mockProducts = [
      { id: '1', name: 'Product A', price: 10, category: 'flower' },
      { id: '2', name: 'Product B', price: 20, category: 'edibles' },
    ];

    const mockSnapshot = {
      docs: mockProducts.map(product => ({
        id: product.id,
        data: () => ({ name: product.name, price: product.price, category: product.category }),
      })),
    };

    vi.mocked(firebase.getDocs).mockResolvedValueOnce(mockSnapshot as any);

    const { result } = renderHook(() => useProducts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.products).toEqual(mockProducts);
    expect(result.current.error).toBeNull();
  });

  test('handles fetch error', async () => {
    vi.mocked(firebase.getDocs).mockRejectedValueOnce(new Error('Firestore error'));

    const { result } = renderHook(() => useProducts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.products).toEqual([]);
    expect(result.current.error).toBe('Failed to load products');
  });
});
