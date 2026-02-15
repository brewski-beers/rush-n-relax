import { useEffect } from 'react';
import { Navigation } from '../components/Navigation';
import { Footer } from '../components/Footer';
import { ContactForm } from '../components/ContactForm';

export default function Contact() {
  useEffect(() => {
    document.title = 'Contact Us - Rush N Relax';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        'content',
        'Contact Rush N Relax with any questions. We are here to help.'
      );
    }
  }, []);

  return (
    <>
      <Navigation />
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
                <h3>Email</h3>
                <ul className="contact-list">
                  <li>
                    <a href="mailto:rush@rushnrelax.com">
                      rush@rushnrelax.com
                    </a>
                  </li>
                  <li>
                    <a href="mailto:capps@rushnrelax.com">
                      capps@rushnrelax.com
                    </a>
                  </li>
                </ul>
              </div>

              <div className="info-card glass">
                <h3>Hours</h3>
                <p>We're open 7 days a week</p>
                <p className="hours-text">
                  Monday - Sunday<br />
                  10:00 AM - 10:00 PM
                </p>
              </div>

              <div className="info-card glass">
                <h3>Locations</h3>
                <p>Visit us at any of our premium locations.</p>
                <a href="/locations" className="btn btn-secondary mt-2">
                  View Locations
                </a>
              </div>
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
      <Footer />
    </>
  );
}
