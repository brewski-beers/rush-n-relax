import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LOCATIONS } from '../constants/locations';

export default function Locations() {
  useEffect(() => {
    document.title = 'Locations - Rush N Relax';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        'content',
        'Find Rush N Relax premium dispensary locations. Open 7 days a week.'
      );
    }
  }, []);

  return (
    <main className="locations-page">
      <section id="locations-hero" className="locations-hero">
          <div className="container">
            <h1>Our Locations</h1>
            <p className="lead">
              Visit any of our premium locations. Open 7 days a week.
            </p>
          </div>
        </section>

        <section id="locations-list" className="locations-list">
          <div className="container">
            <div className="locations-grid">
              {LOCATIONS.map((location) => (
                <Link
                  key={location.id}
                  to={`/locations/${location.slug}`}
                  className="location-card glass"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <h3>{location.name}</h3>
                  <address>
                    <p className="address-line">{location.address}</p>
                    <p className="address-line">
                      {location.city}, {location.state} {location.zip}
                    </p>
                  </address>
                  <div className="location-info">
                    <p className="hours">
                      <strong>Hours:</strong> {location.hours}
                    </p>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.location.href = `tel:${location.phone.replace(/\D/g, '')}`;
                      }}
                      className="phone-link"
                      title={`Call ${location.name}`}
                    >
                      {location.phone}
                    </button>
                  </div>
                  <span className="btn btn-secondary mt-3">
                    View Location →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="locations-contact" className="locations-contact">
          <div className="container">
            <h2>Questions About Our Locations?</h2>
            <p>Reach out to us directly:</p>
            <div className="contact-methods">
              <a
                href="mailto:rush@rushnrelax.com"
                className="contact-method"
                title="Email John Rush"
              >
                <strong>John Rush</strong>
                <span>rush@rushnrelax.com</span>
              </a>
              <a
                href="mailto:capps@rushnrelax.com"
                className="contact-method"
                title="Email Michael Capps"
              >
                <strong>Michael Capps</strong>
                <span>capps@rushnrelax.com</span>
              </a>
            </div>
          </div>
        </section>

        <section id="cta" className="locations-cta">
          <div className="container">
            <h2>Ready to Visit?</h2>
            <a href="/contact" className="btn">
              Get in Touch
            </a>
          </div>
        </section>
      </main>
    );
}
