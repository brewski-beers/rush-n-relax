'use client';

import Link from 'next/link';
import { Card } from '@/components/Card';
import { CardGrid } from '@/components/CardGrid';
import { ProductImage } from '@/components/ProductImage';
import { AddToCartButton } from '@/components/AddToCartButton';
import { formatCents } from '@/utils/currency';
import type { Product, ProductSummary } from '@/types';

export default function ProductDetailClient({
  product,
  relatedProducts,
}: {
  product: Product;
  relatedProducts: ProductSummary[];
}) {
  return (
    <main className="product-detail-page">
      <section className="back-to-products">
        <div className="container">
          <Link href="/products" className="link-button">
            ← Back to All Products
          </Link>
        </div>
      </section>

      <section className="product-hero asymmetry-section-stable page-hero-shell">
        <div className="container">
          <ProductImage
            slug={product.slug}
            alt={product.name}
            className="product-hero-img"
            path={product.image}
          />
          <h1>{product.name}</h1>
          {product.pricing && (
            <p className="product-detail-price">
              {product.pricing.compareAtPrice != null &&
              product.pricing.compareAtPrice > product.pricing.price ? (
                <>
                  <s className="product-price-compare">
                    {formatCents(product.pricing.compareAtPrice)}
                  </s>{' '}
                </>
              ) : null}
              {formatCents(product.pricing.price)}
            </p>
          )}
          <p className="lead">{product.description}</p>
        </div>
      </section>

      <section className="product-info-section asymmetry-section-stable">
        <div className="container">
          <div className="product-detail">
            <div className="product-category-badge">
              {product.category.toUpperCase()}
            </div>
            <div className="product-content">
              <p>{product.details}</p>
            </div>
          </div>
        </div>
      </section>

      {product.images && product.images.length > 0 && (
        <section className="product-gallery-section asymmetry-section-stable">
          <div className="container">
            <div className="product-gallery-strip">
              {product.images.map((imagePath, index) => (
                <ProductImage
                  key={imagePath}
                  slug={product.slug}
                  path={imagePath}
                  alt={`${product.name} image ${index + 1}`}
                  className="product-gallery-img"
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {relatedProducts.length > 0 && (
        <section className="related-products asymmetry-section-anchor">
          <div className="container">
            <h2 className="asymmetry-headline-anchor">Explore More</h2>
            <CardGrid columns="3" gap="lg">
              {relatedProducts.map((related, index) => (
                <Card
                  key={related.id}
                  variant="product-small"
                  to={`/products/${related.slug}`}
                  surface={index === 1 ? 'anchor' : 'stable'}
                  elevation={index === 1 ? 'soft' : 'none'}
                  motion={index === 1}
                >
                  <div className="product-category">
                    {related.category.toUpperCase()}
                  </div>
                  <h3>{related.name}</h3>
                  <p>{related.description}</p>
                </Card>
              ))}
            </CardGrid>
          </div>
        </section>
      )}

      <section className="product-cta asymmetry-section-stable">
        <div className="container">
          <h2>Ready to Add to Your Cart?</h2>
          <p>
            Select a quantity and add this product to your cart, or find us in
            person at one of our locations.
          </p>
          <div className="product-cta-actions">
            <AddToCartButton product={product} showQtySelector />
            <Link href="/locations" className="btn btn-secondary">
              Find a Location
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
