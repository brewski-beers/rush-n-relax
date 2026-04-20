import {
  listOnlineAvailableInventory,
  listProductsByIds,
} from '@/lib/repositories';
import type { ProductSummary } from '@/types';

export interface ProductsPageItem extends ProductSummary {
  featured: boolean;
}

export interface ProductsPage {
  items: ProductsPageItem[];
  nextCursor: string | null;
}

interface FetchOptions {
  limit: number;
  cursor?: string;
  category?: string | null;
}

/**
 * Fetch a page of online-available products for the storefront grid.
 *
 * When no category is set, this paginates inventory directly (1 page → 1 fetch).
 * When a category is set, inventory docs don't carry category (it lives on the
 * product), so we loop through inventory pages until we've collected `limit`
 * matching products or inventory is exhausted. The returned `nextCursor` is
 * always an inventory doc id (or null when inventory is fully scanned).
 */
export async function fetchProductsPage({
  limit,
  cursor,
  category,
}: FetchOptions): Promise<ProductsPage> {
  const collected: ProductsPageItem[] = [];
  let inventoryCursor: string | undefined = cursor;
  let nextCursor: string | null = null;

  // Cap the fill loop. Inventory is small (<1k) and this is a request-time read,
  // but an unbounded loop on a cold cache is not OK.
  const MAX_ITERATIONS = 20;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const { items: inventoryItems, nextCursor: pageCursor } =
      await listOnlineAvailableInventory({
        limit,
        cursor: inventoryCursor,
      });

    nextCursor = pageCursor;

    if (inventoryItems.length > 0) {
      const featuredIds = new Set(
        inventoryItems.filter(it => it.featured).map(it => it.productId)
      );
      const products = await listProductsByIds(
        inventoryItems.map(it => it.productId)
      );
      const filtered = category
        ? products.filter(p => p.category === category)
        : products;

      collected.push(
        ...filtered
          .filter(p => featuredIds.has(p.id))
          .map(p => ({ ...p, featured: true })),
        ...filtered
          .filter(p => !featuredIds.has(p.id))
          .map(p => ({ ...p, featured: false }))
      );
    }

    // Stop when the inventory is exhausted, we have enough matches, or there is
    // no category filter (first inventory page is the storefront page).
    if (!pageCursor || collected.length >= limit || !category) break;
    inventoryCursor = pageCursor;
  }

  return { items: collected, nextCursor };
}
