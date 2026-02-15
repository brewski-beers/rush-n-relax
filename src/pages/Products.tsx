import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CardGrid } from '../components/CardGrid';
import { PRODUCTS } from '../constants/products';
import '../styles/products.css';

export default function Products() {
  useEffect(() => {
    document.title = 'Premium Cannabis Products | Rush N Relax';
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', 'Browse our curated selection of premium cannabis products: concentrates, drinks, edibles, and vapes.');
  }, []);

  return (
    <main className="products-page">
      <section className="products-hero">
          <div className="container">
            <h1>Premium Cannabis Products</h1>
            <p className="lead">A curated selection of high-end products to indulge in every experience at Rush N Relax.</p>
          </div>
        </section>

        <section className="products-grid-section">
          <div className="container">
            <CardGrid columns="auto" gap="lg">
              {PRODUCTS.map((product) => (
                <Link
                  key={product.id}
                  to={`/products/${product.slug}`}
                  className="product-card"
                >
                  <div className="product-card-content">
                    <div className="product-category">{product.category.toUpperCase()}</div>
                    <h2>{product.name}</h2>
                    <p className="product-description">{product.description}</p>
                    <div className="product-cta">View Details →</div>
                  </div>
                </Link>
              ))}
            </CardGrid>
          </div>
        </section>

        <section className="products-cta">
          <div className="container">
            <h2>Ready to Experience Premium?</h2>
            <p>Visit any of our locations to explore our full collection in person.</p>
            <Link to="/locations" className="btn btn-primary">
              Find a Location
            </Link>
          </div>
        </section>
      </main>
    );
  }
