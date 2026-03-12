import Link from 'next/link';
import { ContactForm } from '@/components/ContactForm';
import { listLocations } from '@/lib/repositories';
import { buildMetadata } from '@/lib/seo/metadata.factory';

export const revalidate = 86400;

export const metadata = buildMetadata('/contact', {
  title: 'Contact Us — Rush N Relax Cannabis Dispensary',
  description:
    'Get in touch with Rush N Relax. Send us a message, call any of our three East Tennessee dispensary locations, or email our team directly.',
  path: '/contact',
});

export default async function ContactPage() {
  const locations = await listLocations();
  const activeLocations = locations.filter(loc => loc.hours !== 'Coming soon');

  return (
    <main className="contact-page">
      <section
        id="contact-hero"
        className="contact-hero asymmetry-section-stable page-hero-shell"
      >
        <div className="container">
          <h1>Get in Touch</h1>
          <p className="lead">
            Whether it's a product question, a partnership inquiry, or just
            saying hello — we'd love to hear from you.
          </p>
        </div>
      </section>

      <section
        id="contact-form-section"
        className="contact-form-section asymmetry-section-anchor"
      >
        <div className="container">
          <div className="form-wrapper">
            <ContactForm />
          </div>
        </div>
      </section>

      <section
        id="location-contact"
        className="location-contact asymmetry-section-stable"
      >
        <div className="container">
          <h2>Call a Location Directly</h2>
          <p className="section-lead">
            All locations are open 10 AM – 10 PM, seven days a week.
          </p>
          <ul className="location-phone-list">
            {activeLocations.map((location, index) => (
              <li
                key={location.id}
                className={`location-phone-item ${
                  index % 3 === 1 ? 'asymmetry-anchor' : 'asymmetry-stable'
                }`}
              >
                <span className="location-phone-name">{location.name}</span>
                <a
                  href={`tel:${location.phone}`}
                  className="location-phone-link"
                >
                  {location.phone}
                </a>
                <Link
                  href={`/locations/${location.slug}`}
                  className="location-phone-detail"
                >
                  View location →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
