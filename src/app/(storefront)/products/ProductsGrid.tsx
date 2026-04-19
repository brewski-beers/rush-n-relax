import {
  listOnlineAvailableInventory,
  listProductsByIds,
} from '@/lib/repositories';
import { ProductsGridClient } from './ProductsGridClient';
import type { ProductsPageItem } from '@/app/api/products/route';

const PAGE_SIZE = 25;

interface ProductsGridProps {
  category: string | null;
}

/**
 * Server Component — fetches page 1 of online products and passes it to the
 * Client Component which handles "Load More" via /api/products.
 */
export async function ProductsGrid({ category }: ProductsGridProps) {
  const { items: onlineInventory, nextCursor } =
    await listOnlineAvailableInventory({ limit: PAGE_SIZE });

  const featuredIds = new Set(
    onlineInventory.filter(i => i.featured).map(i => i.productId)
  );

  const products = await listProductsByIds(
    onlineInventory.map(i => i.productId)
  );

  const filtered = category
    ? products.filter(p => p.category === category)
    : products;

  const initialItems: ProductsPageItem[] = [
    ...filtered
      .filter(p => featuredIds.has(p.id))
      .map(p => ({ ...p, featured: true })),
    ...filtered
      .filter(p => !featuredIds.has(p.id))
      .map(p => ({ ...p, featured: false })),
  ];

  return (
    <ProductsGridClient
      initialItems={initialItems}
      initialNextCursor={nextCursor}
      category={category}
    />
  );
}
