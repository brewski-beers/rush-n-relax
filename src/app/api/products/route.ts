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
  fetchProductsPage,
  type ProductsPage,
  type ProductsPageItem,
} from '@/lib/storefront/productsPage';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export type { ProductsPageItem };
export type ProductsApiResponse = ProductsPage;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get('cursor') ?? undefined;
  const category = searchParams.get('category') ?? null;
  const rawLimit = parseInt(
    searchParams.get('limit') ?? String(DEFAULT_LIMIT),
    10
  );
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, rawLimit), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const page = await fetchProductsPage({ limit, cursor, category });

  return NextResponse.json(page satisfies ProductsApiResponse);
}
