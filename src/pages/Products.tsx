import { useEffect } from 'react';
import { Card } from '../components/Card';
import { CardGrid } from '../components/CardGrid';
import { PRODUCTS } from '../constants/products';
import { ProductImage } from '../components/ProductImage';
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
  }, []);

  return (
    <main className="products-page">
      <section className="products-hero">
        <div className="container">
          <h1>Our Products</h1>
          <p className="lead">
            Five categories, one standard — every item on our shelves is
            hand-selected, lab-tested, and stocked because we'd choose it
            ourselves.
          </p>
        </div>
      </section>

      <section className="products-grid-section">
        <div className="container">
          <CardGrid columns="auto" gap="lg">
            {PRODUCTS.map(product => (
              <Card
                key={product.id}
                variant="product"
                to={`/products/${product.slug}`}
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
