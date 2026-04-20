import { fetchProductsPage } from '@/lib/storefront/productsPage';
import { ProductsGridClient } from './ProductsGridClient';

const PAGE_SIZE = 25;

interface ProductsGridProps {
  category: string | null;
}

/**
 * Server Component — fetches page 1 of online products and passes it to the
 * Client Component which handles "Load More" via /api/products.
 *
 * Category filtering uses the shared fill-loop (see fetchProductsPage) so a
 * sparse category keeps scanning inventory until we collect a full page or
 * inventory is exhausted.
 */
export async function ProductsGrid({ category }: ProductsGridProps) {
  const { items, nextCursor } = await fetchProductsPage({
    limit: PAGE_SIZE,
    category,
  });

  return (
    <ProductsGridClient
      initialItems={items}
      initialNextCursor={nextCursor}
      category={category}
    />
  );
}
