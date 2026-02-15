import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ContactForm } from '../components/ContactForm';
import { LOCATIONS } from '../constants/locations';

export default function Contact() {
  useEffect(() => {
    document.title = 'Contact Us - Rush N Relax';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        'content',
        'Contact Rush N Relax with any questions. We are here to help or reach out to any of our locations directly.'
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
              Have questions? We'd love to hear from you. Send us a message and
              we'll respond as soon as possible.
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
                <p>We're open 7 days a week</p>
                <p className="hours-text">
                  Monday - Sunday<br />
                  10:00 AM - 10:00 PM
                </p>
              </div>

              <div className="info-card glass">
                <h3>General Inquiries</h3>
                <p>Questions? Email us or check the footer for contact details.</p>
                <a href="#footer" className="btn btn-secondary mt-2">
                  View Contact Info
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="location-contact" className="location-contact">
          <div className="container">
            <h2>Contact Our Locations</h2>
            <p className="section-lead">Reach out directly to any of our locations</p>
            <div className="locations-grid">
              {activeLocations.map((location) => (
                <div key={location.id} className="location-card glass">
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
                    <p>
                      <strong>Hours:</strong><br />
                      {location.hours}
                    </p>
                  </div>
                  <Link 
                    to={`/locations/${location.slug}`}
                    className="btn btn-secondary mt-2"
                  >
                    View Details
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="must-be-21" className="must-be-21">
          <p>
            <strong>Important:</strong> Must be 21+ years of age. This website
            contains cannabis information. Consult with a healthcare provider
            before use.
          </p>
        </section>
    </main>
  );
}
