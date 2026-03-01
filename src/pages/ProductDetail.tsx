import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { CardGrid } from '../components/CardGrid';
import {
  getProductBySlug,
  getProductSEO,
  PRODUCTS,
} from '../constants/products';
import { ProductImage } from '../components/ProductImage';
import { SITE_URL } from '../constants/site';

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const product = slug ? getProductBySlug(slug) : null;

  useEffect(() => {
    if (!product) {
      navigate('/products', { replace: true });
    }
  }, [product, navigate]);

  useEffect(() => {
    if (!product) return;

    const seo = getProductSEO(product);
    document.title = seo.title;

    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta) descMeta.setAttribute('content', seo.description);

    // Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', seo.url);

    // og:image
    let ogImage = document.querySelector('meta[property="og:image"]');
    if (!ogImage) {
      ogImage = document.createElement('meta');
      ogImage.setAttribute('property', 'og:image');
      document.head.appendChild(ogImage);
    }
    ogImage.setAttribute('content', `${SITE_URL}/og-image.png`);

    // Breadcrumb Schema
    const existingSchemas = document.querySelectorAll(
      'script[type="application/ld+json"]'
    );
    existingSchemas.forEach(script => {
      const content = script.textContent;
      if (
        content &&
        (content.includes('BreadcrumbList') || content.includes('Product'))
      ) {
        script.remove();
      }
    });

    const breadcrumbSchema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: SITE_URL,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Products',
          item: `${SITE_URL}/products`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: product.name,
          item: seo.url,
        },
      ],
    };

    const breadcrumbEl = document.createElement('script');
    breadcrumbEl.setAttribute('type', 'application/ld+json');
    breadcrumbEl.textContent = JSON.stringify(breadcrumbSchema);
    document.head.appendChild(breadcrumbEl);

    // Product Schema
    const productSchema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.details,
      image: `${SITE_URL}/og-image.png`,
      brand: {
        '@type': 'Brand',
        name: 'Rush N Relax',
      },
      category: product.category,
    };

    const productEl = document.createElement('script');
    productEl.setAttribute('type', 'application/ld+json');
    productEl.textContent = JSON.stringify(productSchema);
    document.head.appendChild(productEl);
  }, [product]);

  if (!product) return null;

  // Get other product categories to cross-promote
  const otherProducts = PRODUCTS.filter(p => p.id !== product.id).slice(0, 3);

  return (
    <main className="product-detail-page">
      <section className="back-to-products">
        <div className="container">
          <Link to="/products" className="link-button">
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
                  className={
                    index === 1
                      ? 'rnr-card--anchor asymmetry-motion-anchor'
                      : 'rnr-card--stable'
                  }
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
            to="/locations"
            className="btn btn-primary asymmetry-motion-anchor"
          >
            Find a Location
          </Link>
        </div>
      </section>
    </main>
  );
}
