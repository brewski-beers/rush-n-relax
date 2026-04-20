import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchProductsPage } from '@/lib/storefront/productsPage';
import type { ProductSummary } from '@/types';

const listOnlineAvailableInventory = vi.fn();
const listProductsByIds = vi.fn();

vi.mock('@/lib/repositories', () => ({
  listOnlineAvailableInventory: (...args: unknown[]) =>
    listOnlineAvailableInventory(...args) as unknown,
  listProductsByIds: (...args: unknown[]) =>
    listProductsByIds(...args) as unknown,
}));

type InventoryItem = {
  productId: string;
  featured: boolean;
};

function invPage(ids: string[], nextCursor: string | null) {
  const items: InventoryItem[] = ids.map(id => ({
    productId: id,
    featured: false,
  }));
  return { items, nextCursor };
}

function prod(id: string, category: string): ProductSummary {
  return {
    id,
    slug: id,
    name: id.toUpperCase(),
    category,
    image: null,
    status: 'active',
    availableAt: [],
  } as unknown as ProductSummary;
}

describe('fetchProductsPage', () => {
  beforeEach(() => {
    listOnlineAvailableInventory.mockReset();
    listProductsByIds.mockReset();
  });

  describe('Given no category filter', () => {
    it('fetches a single inventory page and returns its cursor', async () => {
      listOnlineAvailableInventory.mockResolvedValueOnce(
        invPage(['a', 'b', 'c'], 'cursor-1')
      );
      listProductsByIds.mockResolvedValueOnce([
        prod('a', 'flower'),
        prod('b', 'edibles'),
        prod('c', 'vapes'),
      ]);

      const result = await fetchProductsPage({ limit: 25, category: null });

      expect(listOnlineAvailableInventory).toHaveBeenCalledTimes(1);
      expect(result.items).toHaveLength(3);
      expect(result.nextCursor).toBe('cursor-1');
    });
  });

  describe('Given a category with sparse inventory', () => {
    it('keeps scanning inventory pages until the limit is reached', async () => {
      // Page 1: 3 edibles, 0 flower → not enough flower, keep going
      listOnlineAvailableInventory
        .mockResolvedValueOnce(invPage(['e1', 'e2', 'e3'], 'cur-1'))
        .mockResolvedValueOnce(invPage(['f1', 'f2'], 'cur-2'))
        .mockResolvedValueOnce(invPage(['f3'], null));

      listProductsByIds
        .mockResolvedValueOnce([
          prod('e1', 'edibles'),
          prod('e2', 'edibles'),
          prod('e3', 'edibles'),
        ])
        .mockResolvedValueOnce([prod('f1', 'flower'), prod('f2', 'flower')])
        .mockResolvedValueOnce([prod('f3', 'flower')]);

      const result = await fetchProductsPage({
        limit: 3,
        category: 'flower',
      });

      expect(listOnlineAvailableInventory).toHaveBeenCalledTimes(3);
      expect(result.items.map(i => i.id)).toEqual(['f1', 'f2', 'f3']);
      expect(result.nextCursor).toBeNull();
    });

    it('stops once the limit is reached even if more inventory exists', async () => {
      listOnlineAvailableInventory
        .mockResolvedValueOnce(invPage(['e1'], 'cur-1'))
        .mockResolvedValueOnce(invPage(['f1', 'f2', 'f3'], 'cur-2'));

      listProductsByIds
        .mockResolvedValueOnce([prod('e1', 'edibles')])
        .mockResolvedValueOnce([
          prod('f1', 'flower'),
          prod('f2', 'flower'),
          prod('f3', 'flower'),
        ]);

      const result = await fetchProductsPage({
        limit: 2,
        category: 'flower',
      });

      expect(listOnlineAvailableInventory).toHaveBeenCalledTimes(2);
      expect(result.items.map(i => i.id)).toEqual(['f1', 'f2', 'f3']);
      expect(result.nextCursor).toBe('cur-2');
    });

    it('forwards the client cursor on subsequent pages', async () => {
      listOnlineAvailableInventory.mockResolvedValueOnce(invPage(['f1'], null));
      listProductsByIds.mockResolvedValueOnce([prod('f1', 'flower')]);

      await fetchProductsPage({
        limit: 25,
        category: 'flower',
        cursor: 'client-cursor',
      });

      expect(listOnlineAvailableInventory).toHaveBeenCalledWith({
        limit: 25,
        cursor: 'client-cursor',
      });
    });
  });
});
