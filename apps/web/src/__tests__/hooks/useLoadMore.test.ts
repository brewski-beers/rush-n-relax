import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLoadMore } from '@/hooks/useLoadMore';

type Item = { id: string };

function makeFetcher(pages: { items: Item[]; nextCursor: string | null }[]) {
  let callCount = 0;
  return vi.fn(async (_cursor: string) => {
    const page = pages[callCount] ?? { items: [], nextCursor: null };
    callCount++;
    return page;
  });
}

describe('useLoadMore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given initialNextCursor is null', () => {
    it('hasMore is false and loadMore does nothing', () => {
      const fetcher = makeFetcher([]);
      const { result } = renderHook(() =>
        useLoadMore(fetcher, [{ id: 'a' }], null)
      );

      expect(result.current.hasMore).toBe(false);
      expect(result.current.items).toHaveLength(1);

      act(() => result.current.loadMore());

      expect(fetcher).not.toHaveBeenCalled();
    });
  });

  describe('given a single additional page', () => {
    it('appends items and sets hasMore false when nextCursor is null', async () => {
      const fetcher = makeFetcher([
        { items: [{ id: 'b' }, { id: 'c' }], nextCursor: null },
      ]);

      const { result } = renderHook(() =>
        useLoadMore(fetcher, [{ id: 'a' }], 'cursor-1')
      );

      expect(result.current.hasMore).toBe(true);

      await act(async () => {
        result.current.loadMore();
      });

      expect(result.current.items).toHaveLength(3);
      expect(result.current.items.map(i => i.id)).toEqual(['a', 'b', 'c']);
      expect(result.current.hasMore).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('given two more pages', () => {
    it('accumulates items across multiple loadMore calls', async () => {
      const fetcher = makeFetcher([
        { items: [{ id: 'b' }], nextCursor: 'cursor-2' },
        { items: [{ id: 'c' }], nextCursor: null },
      ]);

      const { result } = renderHook(() =>
        useLoadMore(fetcher, [{ id: 'a' }], 'cursor-1')
      );

      await act(async () => { result.current.loadMore(); });
      expect(result.current.items).toHaveLength(2);
      expect(result.current.hasMore).toBe(true);

      await act(async () => { result.current.loadMore(); });
      expect(result.current.items).toHaveLength(3);
      expect(result.current.hasMore).toBe(false);
    });
  });

  describe('when the fetcher throws', () => {
    it('sets isLoading back to false without crashing', async () => {
      const failingFetcher = vi.fn().mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useLoadMore(failingFetcher, [{ id: 'a' }], 'cursor-1')
      );

      await act(async () => { result.current.loadMore(); });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.items).toHaveLength(1);
    });
  });
});
