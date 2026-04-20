'use client';

import { useState, useCallback } from 'react';

interface LoadMoreState<T> {
  items: T[];
  hasMore: boolean;
  isLoading: boolean;
}

interface UseLoadMoreResult<T> {
  items: T[];
  hasMore: boolean;
  isLoading: boolean;
  loadMore: () => void;
}

/**
 * Generic "load more" hook for cursor-based pagination.
 *
 * @param fetcher - async function that accepts a cursor string and returns
 *                  { items: T[], nextCursor: string | null }
 * @param initialItems - first page of items rendered server-side
 * @param initialNextCursor - cursor for page 2 (null = no more pages)
 */
export function useLoadMore<T>(
  fetcher: (cursor: string) => Promise<{ items: T[]; nextCursor: string | null }>,
  initialItems: T[],
  initialNextCursor: string | null
): UseLoadMoreResult<T> {
  const [state, setState] = useState<LoadMoreState<T>>({
    items: initialItems,
    hasMore: initialNextCursor !== null,
    isLoading: false,
  });
  const [cursor, setCursor] = useState<string | null>(initialNextCursor);

  const loadMore = useCallback(() => {
    if (!cursor || state.isLoading) return;

    setState(prev => ({ ...prev, isLoading: true }));

    fetcher(cursor)
      .then(({ items, nextCursor }) => {
        setState(prev => ({
          items: [...prev.items, ...items],
          hasMore: nextCursor !== null,
          isLoading: false,
        }));
        setCursor(nextCursor);
      })
      .catch(() => {
        setState(prev => ({ ...prev, isLoading: false }));
      });
  }, [cursor, fetcher, state.isLoading]);

  return {
    items: state.items,
    hasMore: state.hasMore,
    isLoading: state.isLoading,
    loadMore,
  };
}
