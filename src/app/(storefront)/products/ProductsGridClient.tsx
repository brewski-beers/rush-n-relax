'use client';

import { useCallback } from 'react';
import { Card } from '@/components/Card';
import { CardGrid } from '@/components/CardGrid';
import { ProductImage } from '@/components/ProductImage';
import { useLoadMore } from '@/hooks/useLoadMore';
import type { ProductsPageItem } from '@/app/api/products/route';

interface ProductsGridClientProps {
  initialItems: ProductsPageItem[];
  initialNextCursor: string | null;
  category: string | null;
}

/**
 * Client component that renders the products grid with a "Load More" button.
 * Receives the first page from the server and fetches subsequent pages
 * via the /api/products route.
 */
export function ProductsGridClient({
  initialItems,
  initialNextCursor,
  category,
}: ProductsGridClientProps) {
  const fetcher = useCallback(
    async (cursor: string) => {
      const params = new URLSearchParams({ cursor, limit: '25' });
      if (category) params.set('category', category);
      const res = await fetch(`/api/products?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load products');
      return res.json() as Promise<{
        items: ProductsPageItem[];
        nextCursor: string | null;
      }>;
    },
    [category]
  );

  const { items, hasMore, isLoading, loadMore } = useLoadMore(
    fetcher,
    initialItems,
    initialNextCursor
  );

  return (
    <>
      <CardGrid columns="auto" gap="lg">
        {items.map((product, index) => (
          <Card
            key={product.id}
            variant="product"
            to={`/products/${product.slug}`}
            surface={index % 3 === 1 ? 'anchor' : 'stable'}
            elevation={index % 3 === 1 ? 'soft' : 'none'}
            motion={index % 3 === 1}
          >
            <ProductImage
              slug={product.slug}
              alt={product.name}
              path={product.image}
            />
            <div className="product-card-content">
              <div className="product-category">{product.category}</div>
              <h2>{product.name}</h2>
              <div className="product-card-cta">View Details →</div>
            </div>
          </Card>
        ))}
      </CardGrid>

      {hasMore && (
        <div className="products-load-more">
          <button
            className="load-more-btn"
            onClick={loadMore}
            disabled={isLoading}
            aria-label="Load more products"
          >
            {isLoading ? (
              <span className="load-more-spinner" aria-hidden="true" />
            ) : (
              'Load More'
            )}
          </button>
        </div>
      )}
    </>
  );
}
