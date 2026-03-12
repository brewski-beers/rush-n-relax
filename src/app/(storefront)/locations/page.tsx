import Link from 'next/link';
import { Card } from '@/components/Card';
import { listLocations } from '@/lib/repositories';
import { buildMetadata } from '@/lib/seo/metadata.factory';

export const revalidate = 86400;

export const metadata = buildMetadata('/locations', {
  title: 'Dispensary Locations — Oak Ridge, Maryville & Seymour | Rush N Relax',
  description:
    'Visit Rush N Relax at three East Tennessee dispensary locations — Oak Ridge (with speakeasy lounge), Maryville, and Seymour. Open 7 days a week, 10 AM – 10 PM.',
  path: '/locations',
});

export default async function LocationsPage() {
  const locations = await listLocations();

  return (
    <main className="locations-page">
      <section
        id="locations-hero"
        className="locations-hero asymmetry-section-stable page-hero-shell"
      >
        <div className="container">
          <h1>Our Locations</h1>
          <p className="lead">
            Three dispensaries across East Tennessee — including our signature
            speakeasy lounge in Oak Ridge. Open seven days a week, 10 AM to 10
            PM.
          </p>
        </div>
      </section>

      <section
        id="locations-list"
        className="locations-list asymmetry-section-anchor"
      >
        <div className="container">
          <div className="locations-grid">
            {locations.map((location, index) => (
              <Card
                key={location.id}
                variant="location"
                as="div"
                surface={index % 3 === 1 ? 'anchor' : 'stable'}
                elevation={index % 3 === 1 ? 'soft' : 'none'}
                motion={index % 3 === 1}
              >
                <h3>{location.name}</h3>
                <address>
                  <p className="address-line">{location.address}</p>
                  <p className="address-line">
                    {location.city}, {location.state} {location.zip}
                  </p>
                </address>
                <a
                  href={`tel:${location.phone}`}
                  className="phone-link"
                  title={`Call ${location.name}`}
                >
                  {location.phone}
                </a>
                <Link
                  href={`/locations/${location.slug}`}
                  className="btn btn-secondary mt-3 inline-block"
                >
                  View Location →
                </Link>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="cta" className="locations-cta asymmetry-section-stable">
        <div className="container">
          <h2>Ready to Visit?</h2>
          <p>
            Walk in anytime — no appointment needed, no pressure, just good
            product and better conversation.
          </p>
          <Link href="/contact" className="btn asymmetry-motion-anchor">
            Get in Touch
          </Link>
        </div>
      </section>
    </main>
  );
}
