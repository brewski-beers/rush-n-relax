import { Card } from '@/components/Card';
import { CardGrid } from '@/components/CardGrid';
import { ProductImage } from '@/components/ProductImage';
import { Pagination } from '@/components/Pagination';
import { AddToCartButton } from '@/components/AddToCartButton';
import { formatCents } from '@/utils/currency';
import {
  listOnlineAvailableInventory,
  listProductsByIds,
} from '@/lib/repositories';
import type { ProductSummary } from '@/types';

const PAGE_SIZE = 25;

interface ProductsGridProps {
  category: string | null;
  rawPage: string | undefined;
}

export async function ProductsGrid({ category, rawPage }: ProductsGridProps) {
  const onlineInventory = await listOnlineAvailableInventory();
  const featuredIds = new Set(
    onlineInventory.filter(i => i.featured).map(i => i.productId)
  );
  // Build availability map from inventory
  const availabilityMap = new Map(
    onlineInventory
      .map(i => ({
        productId: i.productId,
        availableOnline: i.availableOnline,
        availablePickup: i.availablePickup,
      }))
      .map(a => [a.productId, a])
  );

  const allProducts = await listProductsByIds(
    onlineInventory.map(i => i.productId)
  );

  const sorted = [
    ...allProducts.filter(p => featuredIds.has(p.id)),
    ...allProducts.filter(p => !featuredIds.has(p.id)),
  ];

  const filtered = category
    ? sorted.filter(p => p.category === category)
    : sorted;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const parsedPage = parseInt(rawPage ?? '1', 10);
  const page = Number.isFinite(parsedPage)
    ? Math.min(Math.max(1, parsedPage), totalPages)
    : 1;
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <CardGrid columns="auto" gap="lg">
        {paginated.map((product, index) => {
          const avail = availabilityMap.get(product.id);
          const productWithAvail: ProductSummary & {
            availableOnline?: boolean;
            availablePickup?: boolean;
          } = {
            ...product,
            availableOnline: avail?.availableOnline,
            availablePickup: avail?.availablePickup,
          };

          return (
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
                <div className="product-category">
                  {product.category.toUpperCase()}
                </div>
                <h2>{product.name}</h2>
                {product.pricing && (
                  <p className="product-card-price">
                    {product.pricing.compareAtPrice != null &&
                    product.pricing.compareAtPrice > product.pricing.price ? (
                      <>
                        <s>
                          {formatCents(product.pricing.compareAtPrice)}
                        </s>{' '}
                      </>
                    ) : null}
                    {formatCents(product.pricing.price)}
                  </p>
                )}
                <p className="product-description">{product.description}</p>
                <div className="product-card-cta">
                  <AddToCartButton product={productWithAvail} />
                  <span>View Details →</span>
                </div>
              </div>
            </Card>
          );
        })}
      </CardGrid>
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        category={category}
      />
    </>
  );
}
