import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { CardGrid } from '../components/CardGrid';
import { PRODUCTS } from '../constants/products';
import { ProductImage } from '../components/ProductImage';
import '../styles/products.css';

export default function Products() {
  useEffect(() => {
    document.title = 'Premium Cannabis Products — Flower, Concentrates, Edibles, Vapes & Drinks | Rush N Relax';
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', 'Browse Rush N Relax\u2019s curated lineup of premium cannabis flower, concentrates, gourmet edibles, sleek vapes, and THCa-infused drinks. Available at all three East Tennessee locations.');
  }, []);

  return (
    <main className="products-page">
      <section className="products-hero">
          <div className="container">
            <h1>Our Products</h1>
            <p className="lead">
              Five categories, one standard — every item on our shelves is
              hand-selected, lab-tested, and stocked because we'd choose it ourselves.
            </p>
          </div>
        </section>

        <section className="products-grid-section">
          <div className="container">
            <CardGrid columns="auto" gap="lg">
              {PRODUCTS.map((product) => (
                <Card key={product.id} variant="product" to={`/products/${product.slug}`}>
                  <ProductImage slug={product.slug} alt={product.name} className="product-card-img" />
                  <div className="product-card-content">
                    <div className="product-category">{product.category.toUpperCase()}</div>
                    <h2>{product.name}</h2>
                    <p className="product-description">{product.description}</p>
                    <div className="product-cta">View Details →</div>
                  </div>
                </Card>
              ))}
            </CardGrid>
          </div>
        </section>

        <section className="products-cta">
          <div className="container">
            <h2>See It All in Person</h2>
            <p>
              Photos can only do so much. Stop by any Rush N Relax location to
              browse, ask questions, and find exactly what fits your experience.
            </p>
            <Link to="/locations" className="btn btn-primary">
              Find a Location
            </Link>
          </div>
        </section>
      </main>
    );
  }
