import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LOCATIONS } from '../constants/locations';
import { getSocialLink, isSocialIconObject } from '../constants/social';
import AllLocationsMap from '../components/AllLocationsMap';

export default function Locations() {
  useEffect(() => {
    document.title = 'Dispensary Locations — Oak Ridge, Maryville & Seymour | Rush N Relax';
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
              Three dispensaries across East Tennessee — including our
              signature speakeasy lounge in Oak Ridge. Open seven
              days a week, 10 AM to 10 PM.
            </p>
          </div>
        </section>

        <section id="locations-map" className="location-map-section">
          <div className="container">
            <h2>Find Us Across East Tennessee</h2>
            <p className="text-secondary">Oak Ridge · Maryville · Seymour</p>
            <AllLocationsMap />
          </div>
        </section>

        <section id="locations-list" className="locations-list">
          <div className="container">
            <div className="locations-grid">
              {LOCATIONS.map((location) => {
                const facebookLink = location.socialLinkIds
                  ?.map(getSocialLink)
                  .find((social) => social.name === 'Facebook');

                return (
                  <article key={location.id} className="location-card glass">
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
                      <a
                        href={`tel:${location.phone.replace(/\D/g, '')}`}
                        className="phone-link"
                        title={`Call ${location.name}`}
                      >
                        {location.phone}
                      </a>
                      {facebookLink && (
                        <a
                          href={facebookLink.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="phone-link location-facebook-link"
                          aria-label={facebookLink.ariaLabel}
                          title={`Visit ${location.name} on Facebook`}
                        >
                          {isSocialIconObject(facebookLink.icon) && (
                            <img
                              src={facebookLink.icon.src}
                              alt={facebookLink.icon.alt}
                              className="social-icon-img"
                            />
                          )}
                          Facebook
                        </a>
                      )}
                    </div>
                    <Link
                      to={`/locations/${location.slug}`}
                      className="btn btn-secondary mt-3"
                      style={{ display: 'inline-block' }}
                    >
                      View Location →
                    </Link>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="cta" className="locations-cta">
          <div className="container">
            <h2>Ready to Visit?</h2>
            <p>Walk in anytime — no appointment needed, no pressure, just good product and better conversation.</p>
            <Link to="/contact" className="btn">
              Get in Touch
            </Link>
          </div>
        </section>
      </main>
    );
}
