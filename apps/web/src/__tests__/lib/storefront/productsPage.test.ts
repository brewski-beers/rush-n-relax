import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchProductsPage } from '@/lib/storefront/productsPage';
import type { ProductSummary } from '@/types';

const listOnlineAvailableInventory = vi.fn();
const listProductsByIds = vi.fn();
const listProductsByCategory = vi.fn();
const getOnlineInStockSet = vi.fn();
const listFeaturedInventory = vi.fn();

vi.mock('@/lib/repositories', () => ({
  listOnlineAvailableInventory: (...args: unknown[]) =>
    listOnlineAvailableInventory(...args) as unknown,
  listProductsByIds: (...args: unknown[]) =>
    listProductsByIds(...args) as unknown,
  listProductsByCategory: (...args: unknown[]) =>
    listProductsByCategory(...args) as unknown,
  getOnlineInStockSet: (...args: unknown[]) =>
    getOnlineInStockSet(...args) as unknown,
  listFeaturedInventory: (...args: unknown[]) =>
    listFeaturedInventory(...args) as unknown,
}));

vi.mock('@/lib/firebase/admin', () => ({
  ONLINE_LOCATION_ID: 'online',
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
    listProductsByCategory.mockReset();
    getOnlineInStockSet.mockReset();
    listFeaturedInventory.mockReset();
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

  describe('Given a category filter (#194 — push category into the query)', () => {
    it('paginates products by category and intersects with online stock', async () => {
      listProductsByCategory.mockResolvedValueOnce({
        items: [
          prod('f1', 'flower'),
          prod('f2', 'flower'),
          prod('f3', 'flower'),
        ],
        nextCursor: null,
      });
      getOnlineInStockSet.mockResolvedValueOnce(new Set(['f1', 'f2', 'f3']));
      listFeaturedInventory.mockResolvedValueOnce({
        items: [],
        nextCursor: null,
      });

      const result = await fetchProductsPage({ limit: 3, category: 'flower' });

      expect(listProductsByCategory).toHaveBeenCalledWith('flower', {
        limit: 3,
        cursor: undefined,
      });
      expect(listOnlineAvailableInventory).not.toHaveBeenCalled();
      expect(result.items.map(i => i.id)).toEqual(['f1', 'f2', 'f3']);
      expect(result.nextCursor).toBeNull();
    });

    it('given 60 products in category X clustered after cursor 50, when fetched with category=X cursor, then returns category-X products from the filtered set', async () => {
      // Bug from MEMORY: previously inventory pagination would fetch 25
      // inventory items at a time and discard non-X items, returning empty
      // pages when X clustered late. With category-aware pagination, the
      // cursor walks the category-filtered product set directly.
      listProductsByCategory.mockResolvedValueOnce({
        items: [prod('x51', 'X'), prod('x52', 'X'), prod('x53', 'X')],
        nextCursor: 'x53',
      });
      getOnlineInStockSet.mockResolvedValueOnce(new Set(['x51', 'x52', 'x53']));
      listFeaturedInventory.mockResolvedValueOnce({
        items: [],
        nextCursor: null,
      });

      const result = await fetchProductsPage({
        limit: 3,
        category: 'X',
        cursor: 'x50',
      });

      expect(listProductsByCategory).toHaveBeenCalledWith('X', {
        limit: 3,
        cursor: 'x50',
      });
      expect(result.items.map(i => i.id)).toEqual(['x51', 'x52', 'x53']);
      expect(result.nextCursor).toBe('x53');
    });

    it('marks featured items via the online-featured set', async () => {
      listProductsByCategory.mockResolvedValueOnce({
        items: [prod('a', 'flower'), prod('b', 'flower')],
        nextCursor: null,
      });
      getOnlineInStockSet.mockResolvedValueOnce(new Set(['a', 'b']));
      listFeaturedInventory.mockResolvedValueOnce({
        items: [{ productId: 'a', featured: true } as InventoryItem],
        nextCursor: null,
      });

      const result = await fetchProductsPage({ limit: 25, category: 'flower' });

      const a = result.items.find(i => i.id === 'a');
      const b = result.items.find(i => i.id === 'b');
      expect(a?.featured).toBe(true);
      expect(b?.featured).toBe(false);
    });

    it('keeps paging when out-of-stock products consume the page', async () => {
      // Page 1: 3 products, only 1 in stock — keep going to fill the limit.
      listProductsByCategory
        .mockResolvedValueOnce({
          items: [prod('a', 'X'), prod('b', 'X'), prod('c', 'X')],
          nextCursor: 'c',
        })
        .mockResolvedValueOnce({
          items: [prod('d', 'X'), prod('e', 'X')],
          nextCursor: null,
        });
      getOnlineInStockSet
        .mockResolvedValueOnce(new Set(['a']))
        .mockResolvedValueOnce(new Set(['d', 'e']));
      listFeaturedInventory.mockResolvedValueOnce({
        items: [],
        nextCursor: null,
      });

      const result = await fetchProductsPage({ limit: 3, category: 'X' });

      expect(listProductsByCategory).toHaveBeenCalledTimes(2);
      expect(result.items.map(i => i.id)).toEqual(['a', 'd', 'e']);
    });
  });
});
