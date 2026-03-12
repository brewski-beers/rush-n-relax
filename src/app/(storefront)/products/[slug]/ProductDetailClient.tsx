'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/Card';
import { CardGrid } from '@/components/CardGrid';
import { getProductBySlug, PRODUCTS } from '@/constants/products';
import { ProductImage } from '@/components/ProductImage';

export default function ProductDetailClient({ slug }: { slug: string }) {
  const router = useRouter();
  const product = getProductBySlug(slug);

  useEffect(() => {
    if (!product) {
      router.replace('/products');
    }
  }, [product, router]);

  if (!product) return null;

  const otherProducts = PRODUCTS.filter(p => p.id !== product.id).slice(0, 3);

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
          />
          <h1>{product.name}</h1>
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

      {otherProducts.length > 0 && (
        <section className="related-products asymmetry-section-anchor">
          <div className="container">
            <h2 className="asymmetry-headline-anchor">Explore More</h2>
            <CardGrid columns="3" gap="lg">
              {otherProducts.map((related, index) => (
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
          <h2>Visit Us to Experience This Product</h2>
          <p>
            Find our locations and explore the full RnR collection in person.
          </p>
          <Link
            href="/locations"
            className="btn btn-primary asymmetry-motion-anchor"
          >
            Find a Location
          </Link>
        </div>
      </section>
    </main>
  );
}
