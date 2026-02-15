import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CardGrid } from '../components/CardGrid';
import { getProductBySlug, getProductSEO, PRODUCTS } from '../constants/products';

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
    ogImage.setAttribute('content', 'https://www.rushnrelax.com/og-image.png');

    // Breadcrumb Schema
    const existingSchemas = document.querySelectorAll('script[type="application/ld+json"]');
    existingSchemas.forEach((script) => {
      const content = script.textContent;
      if (content && (content.includes('BreadcrumbList') || content.includes('Product'))) {
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
          item: 'https://www.rushnrelax.com',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Products',
          item: 'https://www.rushnrelax.com/products',
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
      image: 'https://www.rushnrelax.com/og-image.png',
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

  // Get related products
  const relatedProducts = PRODUCTS.filter(
    (p) => p.category === product.category && p.id !== product.id
  ).slice(0, 3);

  return (
    <main className="product-detail-page">
      <section className="product-hero">
          <div className="container">
            <h1>{product.name}</h1>
            <p className="lead">{product.description}</p>
          </div>
        </section>

        <section className="product-info-section">
          <div className="container">
            <div className="product-detail">
              <div className="product-category-badge">{product.category.toUpperCase()}</div>
              <div className="product-content">
                <h2>Product Details</h2>
                <p>{product.details}</p>
              </div>
            </div>
          </div>
        </section>

        {relatedProducts.length > 0 && (
          <section className="related-products">
            <div className="container">
              <h2>More {product.category.toUpperCase()}</h2>
              <CardGrid columns="3" gap="lg">
                {relatedProducts.map((related) => (
                  <a
                    key={related.id}
                    href={`/products/${related.slug}`}
                    className="product-card-small"
                  >
                    <h3>{related.name}</h3>
                    <p>{related.description}</p>
                  </a>
                ))}
              </CardGrid>
            </div>
          </section>
        )}

        <section className="product-cta">
          <div className="container">
            <h2>Visit Us to Experience This Product</h2>
            <p>Find our locations and explore our full collection in person.</p>
            <a href="/locations" className="btn btn-primary">
              Find a Location
            </a>
          </div>
        </section>

        <section className="back-to-products">
          <div className="container">
            <a href="/products" className="link-button">
              ← Back to All Products
            </a>
          </div>
        </section>
      </main>
    );
  }
