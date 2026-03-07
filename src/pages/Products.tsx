import { useEffect } from 'react';
import { Card } from '../components/Card';
import { CardGrid } from '../components/CardGrid';
import { PRODUCTS } from '../constants/products';
import { ProductImage } from '../components/ProductImage';
import { SITE_URL } from '../constants/site';
import '../styles/products.css';

export default function Products() {
  useEffect(() => {
    document.title =
      'Premium Cannabis Products — Flower, Concentrates, Edibles, Vapes & Drinks | Rush N Relax';
    const desc = document.querySelector('meta[name="description"]');
    if (desc)
      desc.setAttribute(
        'content',
        'Browse Rush N Relax\u2019s curated lineup of premium cannabis flower, concentrates, gourmet edibles, sleek vapes, and THCa-infused drinks. Available at all three East Tennessee locations.'
      );
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', `${SITE_URL}/products`);
  }, []);

  return (
    <main className="products-page">
      <section
        id="products-hero"
        className="products-hero asymmetry-section-stable page-hero-shell"
      >
        <div className="container">
          <h1>Our Products</h1>
          <p className="lead">
            Five categories, one standard — every item on our shelves is
            hand-selected, lab-tested, and stocked because we'd choose it
            ourselves.
          </p>
        </div>
      </section>

      <section
        id="products-grid"
        className="products-grid-section asymmetry-section-anchor"
      >
        <div className="container">
          <CardGrid columns="auto" gap="lg">
            {PRODUCTS.map((product, index) => (
              <Card
                key={product.id}
                variant="product"
                to={`/products/${product.slug}`}
                surface={index % 3 === 1 ? 'anchor' : 'stable'}
                elevation={index % 3 === 1 ? 'soft' : 'none'}
                motion={index % 3 === 1}
              >
                <ProductImage slug={product.slug} alt={product.name} />
                <div className="product-card-content">
                  <div className="product-category">
                    {product.category.toUpperCase()}
                  </div>
                  <h2>{product.name}</h2>
                  <p className="product-description">{product.description}</p>
                  <div className="product-card-cta">View Details →</div>
                </div>
              </Card>
            ))}
          </CardGrid>
        </div>
      </section>
    </main>
  );
}
