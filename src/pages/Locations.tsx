import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { LOCATIONS } from '../constants/locations';

export default function Locations() {
  useEffect(() => {
    document.title =
      'Dispensary Locations — Oak Ridge, Maryville & Seymour | Rush N Relax';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        'content',
        'Visit Rush N Relax at three East Tennessee dispensary locations — Oak Ridge (with speakeasy lounge), Maryville, and Seymour. Open 7 days a week, 10 AM – 10 PM.'
      );
    }
  }, []);

  return (
    <main className="locations-page">
      <section id="locations-hero" className="locations-hero">
        <div className="container">
          <h1>Our Locations</h1>
          <p className="lead">
            Three dispensaries across East Tennessee — including our signature
            speakeasy lounge in Oak Ridge. Open seven days a week, 10 AM to 10
            PM.
          </p>
        </div>
      </section>

      <section id="locations-list" className="locations-list">
        <div className="container">
          <div className="locations-grid">
            {LOCATIONS.map(location => (
              <Card key={location.id} variant="location" as="div">
                <h3>{location.name}</h3>
                <address>
                  <p className="address-line">{location.address}</p>
                  <p className="address-line">
                    {location.city}, {location.state} {location.zip}
                  </p>
                </address>
                <a
                  href={`tel:${location.phone.replace(/\D/g, '')}`}
                  className="phone-link"
                  title={`Call ${location.name}`}
                >
                  {location.phone}
                </a>
                <Link
                  to={`/locations/${location.slug}`}
                  className="btn btn-secondary mt-3"
                  style={{ display: 'inline-block' }}
                >
                  View Location →
                </Link>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="cta" className="locations-cta">
        <div className="container">
          <h2>Ready to Visit?</h2>
          <p>
            Walk in anytime — no appointment needed, no pressure, just good
            product and better conversation.
          </p>
          <Link to="/contact" className="btn">
            Get in Touch
          </Link>
        </div>
      </section>
    </main>
  );
}
