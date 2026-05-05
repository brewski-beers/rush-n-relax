import {
  listProductsByCategory,
  listProductsInStockAt,
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
 * No category — single Firestore query against `products` filtered by
 * `inStockAt array-contains <ONLINE_LOCATION_ID>` (#310). Replaces the
 * previous inventory→listProductsByIds N+1 round-trip.
 *
 * With category — paginate `products` by category at the Firestore query
 * level (composite index on status+category+name), then drop products that
 * are not online-in-stock by reading the denormalized `inStockAt` array on
 * each product (no extra Firestore read). Featured stamping uses the
 * denormalized `featuredAt` array on the same product doc.
 */
export async function fetchProductsPage({
  limit,
  cursor,
  category,
}: FetchOptions): Promise<ProductsPage> {
  if (category) {
    return fetchByCategory(limit, cursor, category);
  }
  return fetchOnline(limit, cursor);
}

async function fetchOnline(
  limit: number,
  cursor?: string
): Promise<ProductsPage> {
  const { items: products, nextCursor } = await listProductsInStockAt(
    ONLINE_LOCATION_ID,
    { limit, cursor }
  );

  if (products.length === 0) {
    return { items: [], nextCursor };
  }

  const stamped: ProductsPageItem[] = products.map(p => ({
    ...p,
    featured: p.featuredAt?.includes(ONLINE_LOCATION_ID) ?? false,
  }));

  // Stable ordering: featured first, otherwise preserve query order (name).
  const collected: ProductsPageItem[] = [
    ...stamped.filter(p => p.featured),
    ...stamped.filter(p => !p.featured),
  ];

  return { items: collected, nextCursor };
}

async function fetchByCategory(
  limit: number,
  cursor: string | undefined,
  category: string
): Promise<ProductsPage> {
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

    const inStockProducts = products.filter(p =>
      p.inStockAt?.includes(ONLINE_LOCATION_ID)
    );
    collected.push(
      ...inStockProducts.map(p => ({
        ...p,
        featured: p.featuredAt?.includes(ONLINE_LOCATION_ID) ?? false,
      }))
    );

    if (!pageCursor || collected.length >= limit) break;
    productCursor = pageCursor;
  }

  return { items: collected, nextCursor };
}
