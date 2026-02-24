import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { ContactForm } from '../components/ContactForm';
import { LOCATIONS } from '../constants/locations';
import { getSocialLink, isSocialIconObject } from '../constants/social';

export default function Contact() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Contact Us — Rush N Relax Cannabis Dispensary';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        'content',
        'Get in touch with Rush N Relax. Send us a message, call any of our three East Tennessee dispensary locations, or email our team directly.'
      );
    }
  }, []);

  const activeLocations = LOCATIONS.filter((loc) => loc.hours !== 'Coming soon');

  return (
    <main className="contact-page">
        <section id="contact-hero" className="contact-hero">
          <div className="container">
            <h1>Get in Touch</h1>
            <p className="lead">
              Whether it's a product question, a partnership inquiry, or just
              saying hello — we'd love to hear from you.
            </p>
          </div>
        </section>

        <section id="contact-form-section" className="contact-form-section">
          <div className="container">
            <div className="form-wrapper">
              <ContactForm />
            </div>
          </div>
        </section>

        <section id="contact-info" className="contact-info">
          <div className="container">
            <h2>Other Ways to Reach Us</h2>
            <div className="info-grid">
              <div className="info-card glass">
                <h3>Hours</h3>
                <p>All locations — 7 days a week</p>
                <p className="hours-text">
                  Monday – Sunday<br />
                  10:00 AM – 10:00 PM
                </p>
              </div>
              <div className="info-card glass">
                <h3>Email</h3>
                <p>Reach our team directly</p>
                <p className="hours-text">
                  <a href="mailto:rush@rushnrelax.com">rush@rushnrelax.com</a><br />
                  <a href="mailto:capps@rushnrelax.com">capps@rushnrelax.com</a>
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="location-contact" className="location-contact">
          <div className="container">
            <h2>Call a Location Directly</h2>
            <p className="section-lead">All three locations are open 10 AM – 10 PM, seven days a week. Give us a ring during business hours.</p>
            <div className="locations-grid">
              {activeLocations.map((location) => {
                const facebookLink = location.socialLinkIds
                  ?.map(getSocialLink)
                  .find((social) => social.name === 'Facebook');
                
                const handleCardClick = (e: React.MouseEvent) => {
                  // Only navigate if clicking on the card itself, not nested interactive elements
                  if ((e.target as HTMLElement).closest('a, button')) {
                    return;
                  }
                  navigate(`/locations/${location.slug}`);
                };

                return (
                  <Card 
                    key={location.id} 
                    variant="location" 
                    as="div"
                    style={{ cursor: 'pointer' }}
                    onClick={handleCardClick}
                  >
                    <h3>{location.name}</h3>
                    <p className="location-address">
                      {location.address}<br />
                      {location.city}, {location.state} {location.zip}
                    </p>
                    <div className="location-contact-info">
                      <p>
                        <strong>Phone:</strong><br />
                        <a href={`tel:${location.phone}`}>{location.phone}</a>
                      </p>
                      {facebookLink && (
                        <p>
                          <strong>Facebook:</strong><br />
                          <a
                            href={facebookLink.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="location-facebook-link"
                            aria-label={facebookLink.ariaLabel}
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
                        </p>
                      )}
                    </div>
                    <span className="btn btn-secondary mt-2" style={{ display: 'inline-block' }}>
                      View Details
                    </span>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

    </main>
  );
}
