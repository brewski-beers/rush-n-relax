import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useProductBySlug } from './index';
import * as firebase from 'firebase/firestore';

// Mock firebase/firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
}));

// Mock firebase module
vi.mock('@/firebase', () => ({
  db: {},
}));

describe('useProductBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('initially returns loading state', () => {
    vi.mocked(firebase.getDocs).mockImplementation(() => new Promise(() => {}));
    
    const { result } = renderHook(() => useProductBySlug('flower', 'test-product'));
    
    expect(result.current.loading).toBe(true);
    expect(result.current.product).toBeNull();
    expect(result.current.error).toBeNull();
  });

  test('fetches product by category and slug successfully', async () => {
    const mockProduct = {
      name: 'Test Product',
      slug: 'test-product',
      price: 10,
      category: 'flower',
      description: 'A test product',
    };

    const mockSnapshot = {
      empty: false,
      docs: [{
        id: '1',
        data: () => mockProduct,
      }],
    };

    vi.mocked(firebase.getDocs).mockResolvedValueOnce(mockSnapshot as any);

    const { result } = renderHook(() => useProductBySlug('flower', 'test-product'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.product).toEqual({
      id: '1',
      ...mockProduct,
    });
    expect(result.current.error).toBeNull();
  });

  test('handles product not found', async () => {
    const mockSnapshot = {
      empty: true,
      docs: [],
    };

    vi.mocked(firebase.getDocs).mockResolvedValueOnce(mockSnapshot as any);

    const { result } = renderHook(() => useProductBySlug('edibles', 'nonexistent'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.product).toBeNull();
    expect(result.current.error).toBe('Product not found');
  });

  test('handles fetch error', async () => {
    vi.mocked(firebase.getDocs).mockRejectedValueOnce(new Error('Firestore error'));

    const { result } = renderHook(() => useProductBySlug('vapes', 'test-product'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.product).toBeNull();
    expect(result.current.error).toBe('Failed to load product');
  });

  test('handles empty category or slug', async () => {
    const { result } = renderHook(() => useProductBySlug('flower', ''));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.product).toBeNull();
    expect(result.current.error).toBe('Invalid category or product slug');
  });
});
