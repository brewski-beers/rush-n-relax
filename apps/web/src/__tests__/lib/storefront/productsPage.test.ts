import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchProductsPage } from '@/lib/storefront/productsPage';
import type { Product, ProductSummary } from '@/types';

const listProductsInStockAt = vi.fn();
const listProductsByCategory = vi.fn();

vi.mock('@/lib/repositories', () => ({
  listProductsInStockAt: (...args: unknown[]) =>
    listProductsInStockAt(...args) as unknown,
  listProductsByCategory: (...args: unknown[]) =>
    listProductsByCategory(...args) as unknown,
}));

vi.mock('@/lib/firebase/admin', () => ({
  ONLINE_LOCATION_ID: 'online',
}));

function product(
  id: string,
  category: string,
  opts: { inStock?: boolean; featured?: boolean } = {}
): Product {
  const inStockAt = opts.inStock === false ? [] : ['online'];
  const featuredAt = opts.featured ? ['online'] : [];
  return {
    id,
    slug: id,
    name: id.toUpperCase(),
    category,
    details: '',
    status: 'active',
    availableAt: [],
    inStockAt,
    featuredAt,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  } as unknown as Product;
}

function summary(
  id: string,
  category: string,
  opts: { inStock?: boolean; featured?: boolean } = {}
): ProductSummary {
  const inStockAt = opts.inStock === false ? [] : ['online'];
  const featuredAt = opts.featured ? ['online'] : [];
  return {
    id,
    slug: id,
    name: id.toUpperCase(),
    category,
    status: 'active',
    availableAt: [],
    inStockAt,
    featuredAt,
  } as unknown as ProductSummary;
}

describe('fetchProductsPage (#310 inStockAt query path)', () => {
  beforeEach(() => {
    listProductsInStockAt.mockReset();
    listProductsByCategory.mockReset();
  });

  describe('Given no category filter', () => {
    it('issues a single inStockAt query and returns its cursor', async () => {
      listProductsInStockAt.mockResolvedValueOnce({
        items: [
          product('a', 'flower'),
          product('b', 'edibles'),
          product('c', 'vapes'),
        ],
        nextCursor: 'cursor-1',
      });

      const result = await fetchProductsPage({ limit: 25, category: null });

      expect(listProductsInStockAt).toHaveBeenCalledTimes(1);
      expect(listProductsInStockAt).toHaveBeenCalledWith('online', {
        limit: 25,
        cursor: undefined,
      });
      expect(result.items).toHaveLength(3);
      expect(result.nextCursor).toBe('cursor-1');
    });

    it('does NOT issue a separate listProductsByIds round-trip', async () => {
      listProductsInStockAt.mockResolvedValueOnce({
        items: [product('a', 'flower')],
        nextCursor: null,
      });

      await fetchProductsPage({ limit: 25, category: null });

      // Only the single denormalized query — no follow-up fetch needed.
      expect(listProductsInStockAt).toHaveBeenCalledTimes(1);
    });

    it('stamps featured flag from the product.featuredAt array', async () => {
      listProductsInStockAt.mockResolvedValueOnce({
        items: [
          product('a', 'flower', { featured: true }),
          product('b', 'flower'),
        ],
        nextCursor: null,
      });

      const result = await fetchProductsPage({ limit: 25, category: null });

      const a = result.items.find(i => i.id === 'a');
      const b = result.items.find(i => i.id === 'b');
      expect(a?.featured).toBe(true);
      expect(b?.featured).toBe(false);
      // Featured items render first in the page.
      expect(result.items[0]?.id).toBe('a');
    });

    it('returns empty page when the inStockAt query yields nothing', async () => {
      listProductsInStockAt.mockResolvedValueOnce({
        items: [],
        nextCursor: null,
      });

      const result = await fetchProductsPage({ limit: 25, category: null });

      expect(result.items).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });
  });

  describe('Given a category filter', () => {
    it('paginates products by category and filters by inStockAt without extra round-trips', async () => {
      listProductsByCategory.mockResolvedValueOnce({
        items: [
          summary('f1', 'flower'),
          summary('f2', 'flower'),
          summary('f3', 'flower'),
        ],
        nextCursor: null,
      });

      const result = await fetchProductsPage({ limit: 3, category: 'flower' });

      expect(listProductsByCategory).toHaveBeenCalledWith('flower', {
        limit: 3,
        cursor: undefined,
      });
      expect(listProductsInStockAt).not.toHaveBeenCalled();
      expect(result.items.map(i => i.id)).toEqual(['f1', 'f2', 'f3']);
    });

    it('filters out products whose inStockAt does not include the online location', async () => {
      listProductsByCategory.mockResolvedValueOnce({
        items: [
          summary('a', 'flower'),
          summary('b', 'flower', { inStock: false }),
          summary('c', 'flower'),
        ],
        nextCursor: null,
      });

      const result = await fetchProductsPage({ limit: 25, category: 'flower' });

      expect(result.items.map(i => i.id)).toEqual(['a', 'c']);
    });

    it('keeps paging when out-of-stock products consume the page', async () => {
      listProductsByCategory
        .mockResolvedValueOnce({
          items: [
            summary('a', 'X'),
            summary('b', 'X', { inStock: false }),
            summary('c', 'X', { inStock: false }),
          ],
          nextCursor: 'c',
        })
        .mockResolvedValueOnce({
          items: [summary('d', 'X'), summary('e', 'X')],
          nextCursor: null,
        });

      const result = await fetchProductsPage({ limit: 3, category: 'X' });

      expect(listProductsByCategory).toHaveBeenCalledTimes(2);
      expect(result.items.map(i => i.id)).toEqual(['a', 'd', 'e']);
    });

    it('stamps featured flag from product.featuredAt rather than a separate inventory call', async () => {
      listProductsByCategory.mockResolvedValueOnce({
        items: [
          summary('a', 'flower', { featured: true }),
          summary('b', 'flower'),
        ],
        nextCursor: null,
      });

      const result = await fetchProductsPage({ limit: 25, category: 'flower' });

      const a = result.items.find(i => i.id === 'a');
      const b = result.items.find(i => i.id === 'b');
      expect(a?.featured).toBe(true);
      expect(b?.featured).toBe(false);
    });
  });
});
