import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { CardGrid } from '../components/CardGrid';
import { LOCATIONS } from '../constants/locations';
import { PRODUCTS } from '../constants/products';
import { ProductImage } from '../components/ProductImage';

export default function Home() {
  useEffect(() => {
    document.title =
      'Rush N Relax — Premium Cannabis Dispensary | East Tennessee';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        'content',
        'Rush N Relax: East Tennessee\u2019s upscale cannabis dispensary and speakeasy-style lounge. Premium flower, concentrates, edibles, vapes & THCa drinks in Oak Ridge, Maryville, and Seymour.'
      );
    }
  }, []);

  return (
    <main className="home-page">
      <section id="hero" className="hero page-hero-shell">
        <div className="hero-content">
          <h1 className="hero-title">RUSH N RELAX</h1>
          <p className="hero-subtitle">
            East Tennessee's premier cannabis experience.
          </p>
          <p className="hero-description">
            Three dispensaries. One speakeasy-style lounge. A curated collection
            of flower, concentrates, edibles, vapes, and THCa-infused drinks —
            all selected for quality you can see, smell, and feel.
          </p>
          <div className="hero-ctas">
            <Link to="/locations" className="btn asymmetry-motion-anchor">
              Find a Location
            </Link>
            <Link to="/products" className="btn btn-secondary">
              Explore Products
            </Link>
          </div>
        </div>
      </section>

      <section id="story" className="story asymmetry-section-stable">
        <div className="container">
          <h2>The Rush N Relax Difference</h2>
          <p>
            Cannabis has always been about more than what's in the jar. It's
            about the welcome you get when you walk in, the conversation that
            helps you find the right product, and the atmosphere that turns a
            quick stop into the best part of your day. That's the standard we
            hold across every Rush N Relax location — and it's why people come
            back.
          </p>
          <Link to="/about" className="link-arrow">
            Learn More About Us →
          </Link>
        </div>
      </section>

      <section
        id="products-preview"
        className="products-preview asymmetry-section-anchor"
      >
        <div className="container">
          <h2 className="asymmetry-headline-anchor">What We Carry</h2>
          <p className="text-secondary">
            Hand-selected products across five categories — each held to the
            same uncompromising standard.
          </p>
          <CardGrid columns="auto" gap="lg">
            {PRODUCTS.slice(0, 3).map((product, index) => (
              <Card
                key={product.id}
                variant="product"
                to={`/products/${product.slug}`}
                className={
                  index === 1
                    ? 'rnr-card--anchor asymmetry-motion-anchor'
                    : 'rnr-card--stable'
                }
              >
                <ProductImage slug={product.slug} alt={product.name} />
                <div className="product-card-content">
                  <div className="product-category">
                    {product.category.toUpperCase()}
                  </div>
                  <h2>{product.name}</h2>
                  <p className="product-description">{product.description}</p>
                  <div className="product-cta">Learn More →</div>
                </div>
              </Card>
            ))}
          </CardGrid>
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <Link to="/products" className="link-arrow">
              View All Products →
            </Link>
          </div>
        </div>
      </section>

      <section
        id="locations"
        className="locations-preview asymmetry-section-stable"
      >
        <div className="container">
          <h2>Three Locations Across East Tennessee</h2>
          <p className="text-secondary">
            Oak Ridge · Maryville · Seymour — open seven days a week, 10 AM to
            10 PM.
          </p>
          <div className="locations-grid">
            {LOCATIONS.map((loc, index) => (
              <Card
                key={loc.id}
                variant="location"
                to={`/locations/${loc.slug}`}
                className={
                  index === 1
                    ? 'rnr-card--anchor asymmetry-motion-anchor'
                    : 'rnr-card--stable'
                }
              >
                <h3>{loc.name}</h3>
                <p className="address-line">{loc.address}</p>
                <p className="address-line">
                  {loc.city}, {loc.state} {loc.zip}
                </p>
                <span
                  className="btn btn-secondary mt-3"
                  style={{ display: 'inline-block' }}
                >
                  View Location →
                </span>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
