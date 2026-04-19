/**
 * GET /api/products?cursor=<docId>&category=<slug>&limit=<n>
 *
 * Storefront products pagination endpoint.
 * Returns the next page of online-available products joined with inventory data.
 * All Firestore access goes through repository functions — never inline.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  listOnlineAvailableInventory,
  listProductsByIds,
  type PageResult,
} from '@/lib/repositories';
import type { ProductSummary } from '@/types';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export interface ProductsPageItem extends ProductSummary {
  featured: boolean;
}

export type ProductsApiResponse = PageResult<ProductsPageItem>;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get('cursor') ?? undefined;
  const category = searchParams.get('category') ?? undefined;
  const rawLimit = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, rawLimit), MAX_LIMIT)
    : DEFAULT_LIMIT;

  // Fetch online inventory page — cursor points into the online-inventory subcollection
  const { items: inventoryItems, nextCursor } =
    await listOnlineAvailableInventory({ limit, cursor });

  if (inventoryItems.length === 0) {
    return NextResponse.json({ items: [], nextCursor: null } satisfies ProductsApiResponse);
  }

  const featuredIds = new Set(
    inventoryItems.filter(i => i.featured).map(i => i.productId)
  );

  // Fetch product details for the current inventory page
  const products = await listProductsByIds(
    inventoryItems.map(i => i.productId)
  );

  // Optionally filter by category (client passes ?category=flower)
  const filtered = category
    ? products.filter(p => p.category === category)
    : products;

  // Sort: featured first, then alphabetical
  const sorted: ProductsPageItem[] = [
    ...filtered
      .filter(p => featuredIds.has(p.id))
      .map(p => ({ ...p, featured: true })),
    ...filtered
      .filter(p => !featuredIds.has(p.id))
      .map(p => ({ ...p, featured: false })),
  ];

  return NextResponse.json({
    items: sorted,
    nextCursor,
  } satisfies ProductsApiResponse);
}
