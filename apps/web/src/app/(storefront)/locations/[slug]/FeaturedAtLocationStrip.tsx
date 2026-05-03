import Link from 'next/link';
import { Card } from '@/components/Card';
import { CardGrid } from '@/components/CardGrid';
import { ProductImage } from '@/components/ProductImage';
import { getStorageUrl } from '@/lib/storage/url-cache';
import { listFeaturedAtLocation, listProductsByIds } from '@/lib/repositories';

const MAX_FEATURED = 6;

/**
 * Server component — renders a horizontal strip of featured-and-in-stock
 * products at the given retail location (#238). Hides itself entirely when
 * the location has zero matches.
 */
export async function FeaturedAtLocationStrip({
  locationId,
}: {
  locationId: string;
}) {
  const items = await listFeaturedAtLocation(locationId);
  if (items.length === 0) return null;

  const products = await listProductsByIds(items.map(i => i.productId));
  const display = products.slice(0, MAX_FEATURED);
  if (display.length === 0) return null;

  return (
    <section
      className="location-featured-strip asymmetry-section-stable"
      data-testid="location-featured-strip"
      aria-labelledby="location-featured-heading"
    >
      <div className="container">
        <h2 id="location-featured-heading">Featured at this location</h2>
        <CardGrid columns="auto" gap="md">
          {display.map(product => (
            <Card
              key={product.id}
              variant="product"
              to={`/products/${product.slug}`}
              surface="stable"
            >
              <ProductImage
                alt={product.name}
                src={product.image ? getStorageUrl(product.image) : undefined}
              />
              <div className="product-card-content">
                <div className="product-category">{product.category}</div>
                <h3>{product.name}</h3>
                <div className="product-cta">View Product →</div>
              </div>
            </Card>
          ))}
        </CardGrid>
      </div>
    </section>
  );
}

// Keep Link import in case downstream variants want a "View All" CTA
void Link;
