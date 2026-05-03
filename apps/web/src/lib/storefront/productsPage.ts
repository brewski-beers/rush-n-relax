import {
  listOnlineAvailableInventory,
  listProductsByIds,
  listProductsByCategory,
  getOnlineInStockSet,
  listFeaturedInventory,
} from '@/lib/repositories';
import { ONLINE_LOCATION_ID } from '@/lib/firebase/admin';
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
 * No category — paginate the online inventory directly (1 page → 1 fetch).
 *
 * With category (#194) — paginate `products` filtered by category at the
 * Firestore query level (composite index already declared on
 * status+category+name), then intersect with the online in-stock set in
 * batches. The cursor is a product id (the last product seen on the page),
 * which makes Load More O(limit) per request rather than scanning all
 * inventory until a category cluster is found. Featured flags come from a
 * single page of `listFeaturedInventory(ONLINE_LOCATION_ID)` because online
 * featured items are <25 in practice.
 */
export async function fetchProductsPage({
  limit,
  cursor,
  category,
}: FetchOptions): Promise<ProductsPage> {
  if (category) {
    return fetchByCategory(limit, cursor, category);
  }
  return fetchByInventory(limit, cursor);
}

async function fetchByInventory(
  limit: number,
  cursor?: string
): Promise<ProductsPage> {
  const { items: inventoryItems, nextCursor } =
    await listOnlineAvailableInventory({ limit, cursor });

  if (inventoryItems.length === 0) {
    return { items: [], nextCursor };
  }

  const featuredIds = new Set(
    inventoryItems.filter(it => it.featured).map(it => it.productId)
  );
  const products = await listProductsByIds(
    inventoryItems.map(it => it.productId)
  );

  const collected: ProductsPageItem[] = [
    ...products
      .filter(p => featuredIds.has(p.id))
      .map(p => ({ ...p, featured: true })),
    ...products
      .filter(p => !featuredIds.has(p.id))
      .map(p => ({ ...p, featured: false })),
  ];

  return { items: collected, nextCursor };
}

async function fetchByCategory(
  limit: number,
  cursor: string | undefined,
  category: string
): Promise<ProductsPage> {
  // Pre-fetch the small online-featured set once. Featured items are flagged
  // per-product so we can stamp the boolean cheaply per result.
  const featuredPagePromise = listFeaturedInventory(ONLINE_LOCATION_ID);

  // Loop in case some category-page products are out of stock — keep paging
  // until we collect `limit` matches or run out of products in the category.
  const collected: ProductsPageItem[] = [];
  let productCursor: string | undefined = cursor;
  let nextCursor: string | null = null;
  const MAX_ITERATIONS = 20;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const { items: products, nextCursor: pageCursor } =
      await listProductsByCategory(category, {
        limit,
        cursor: productCursor,
      });
    nextCursor = pageCursor;

    if (products.length === 0) break;

    const inStockIds = await getOnlineInStockSet(products.map(p => p.id));
    const inStockProducts = products.filter(p => inStockIds.has(p.id));
    collected.push(
      ...inStockProducts.map(p => ({ ...p, featured: false as boolean }))
    );

    if (!pageCursor || collected.length >= limit) break;
    productCursor = pageCursor;
  }

  // Mark featured flags by intersecting with the online-featured set.
  const featuredPage = await featuredPagePromise;
  const featuredIds = new Set(
    featuredPage.items.filter(it => it.featured).map(it => it.productId)
  );
  for (const item of collected) {
    if (featuredIds.has(item.id)) item.featured = true;
  }

  return { items: collected, nextCursor };
}
