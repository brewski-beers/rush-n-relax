import { useEffect } from 'react';
import { Navigation } from '../components/Navigation';
import { Footer } from '../components/Footer';

export default function Home() {
  useEffect(() => {
    document.title = 'Rush N Relax - Premium Cannabis Experience';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        'content',
        'Experience premium cannabis at Rush N Relax. Upscale dispensary and speakeasy-style lounge.'
      );
    }
  }, []);

  return (
    <>
      <Navigation />
      <main className="home-page">
        <section id="hero" className="hero">
          <div className="hero-content">
            <h1 className="hero-title">RUSH N RELAX</h1>
            <p className="hero-subtitle">
              More than just a product. It's an experience.
            </p>
            <p className="hero-description">
              At Rush N Relax, we believe cannabis is more than just a product —
              it's an experience. Our upscale dispensary and speakeasy-style
              lounge offers a curated selection of flower, edibles, concentrates,
              vapes, and more.
            </p>
            <div className="hero-ctas">
              <a href="/locations" className="btn">
                Find Us
              </a>
              <a href="/about" className="btn btn-secondary">
                Our Story
              </a>
            </div>
          </div>
        </section>

        <section id="story" className="story">
          <div className="container">
            <h2>Our Story</h2>
            <p>
              We are dedicated to providing a premium cannabis experience that
              celebrates the plant and respects our community. Every product is
              carefully curated to meet our exacting standards.
            </p>
            <a href="/about" className="link-arrow">
              Learn More About Us →
            </a>
          </div>
        </section>

        <section id="locations" className="locations-preview">
          <div className="container">
            <h2>Visit Us</h2>
            <p>Open 7 days a week at multiple premium locations.</p>
            <a href="/locations" className="btn mt-4">
              View All Locations
            </a>
          </div>
        </section>

        <section id="contact-cta" className="contact-cta">
          <div className="container">
            <h2>Get in Touch</h2>
            <p>Have questions? We're here to help.</p>
            <a href="/contact" className="btn">
              Contact Us
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
