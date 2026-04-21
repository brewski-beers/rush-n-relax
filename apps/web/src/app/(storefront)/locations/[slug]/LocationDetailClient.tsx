'use client';

import Link from 'next/link';
import { Card } from '@/components/Card';
import { ReviewsSection } from '@/components/ReviewsSection';
import { getSocialLink, isSocialIconObject } from '@/constants/social';
import { useLocationReviews } from '@/hooks/useLocationReviews';
import type { Location, PromoSummary } from '@/types';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function LocationDetailClient({
  location,
  promos,
}: {
  location: Location;
  promos: PromoSummary[];
}) {
  const mapQuery = location.placeId
    ? `place_id:${location.placeId}`
    : `${location.address}, ${location.city}, ${location.state} ${location.zip}`;

  const {
    rating,
    totalRatings,
    reviews,
    status: reviewsStatus,
  } = useLocationReviews(location.placeId);

  return (
    <main className="location-detail-page">
      <section className="back-to-locations">
        <div className="container">
          <Link href="/locations" className="link-button">
            ← Back to All Locations
          </Link>
        </div>
      </section>

      <section className="location-hero asymmetry-section-stable page-hero-shell">
        <div className="container">
          <h1>{location.name}</h1>
          <p className="lead">{location.description}</p>
        </div>
      </section>

      <ReviewsSection
        rating={rating}
        totalRatings={totalRatings}
        reviews={reviews}
        status={reviewsStatus}
        locationName={location.name}
      />

      {promos.length > 0 && (
        <section className="location-promos-section asymmetry-section-stable">
          <div className="container location-promos-inner">
            {promos.map(promo => (
              <Card
                key={promo.id}
                variant="info"
                as="div"
                surface="anchor"
                elevation="soft"
                motion
                className="location-promo-plug"
              >
                <p className="promo-kicker">In Store Now</p>
                <h2>{promo.name}</h2>
                <p className="lead">{promo.tagline}</p>
                <Link
                  href={`/promo/${promo.slug}`}
                  className="btn location-promo-plug-cta"
                >
                  See Details →
                </Link>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="location-info-section asymmetry-section-anchor">
        <div className="location-detail-grid">
          <Card variant="info" as="div" surface="stable">
            <h2>Visit Us</h2>
            <address>
              <p>{location.address}</p>
              <p>
                {location.city}, {location.state} {location.zip}
              </p>
            </address>
            {location.coordinates && (
              <a
                href={`https://www.google.com/maps/search/${encodeURIComponent(
                  location.address
                )},+${encodeURIComponent(location.city)},+${location.state}`}
                target="_blank"
                rel="noopener noreferrer"
                className="info-directions-link"
              >
                Get Directions →
              </a>
            )}
            <div className="info-divider" />
            <p className="info-label">Hours</p>
            <p>{location.hours}</p>
            <p className="text-secondary">Open 7 days a week</p>
          </Card>

          <Card
            variant="info"
            as="div"
            surface="anchor"
            elevation="soft"
            motion
          >
            <h2>Call Us</h2>
            <a
              href={`tel:${location.phone.replace(/\D/g, '')}`}
              className="phone-link phone-link--large"
            >
              {location.phone}
            </a>
            <p className="text-secondary">Available during business hours</p>
            {location.socialLinkIds && location.socialLinkIds.length > 0 && (
              <>
                <div className="info-divider" />
                <p className="info-label">Follow Us</p>
                <div className="social-links-grid">
                  {location.socialLinkIds.map(socialId => {
                    const social = getSocialLink(socialId);
                    return (
                      <a
                        key={socialId}
                        href={social.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="social-link-item"
                        aria-label={social.ariaLabel}
                        title={social.name}
                      >
                        <span className="social-icon">
                          {isSocialIconObject(social.icon) ? (
                            <img
                              src={social.icon.src}
                              alt={social.icon.alt}
                              className="social-icon-img"
                            />
                          ) : (
                            social.icon
                          )}
                        </span>
                        <span className="social-name">{social.name}</span>
                      </a>
                    );
                  })}
                </div>
              </>
            )}
          </Card>

          {location.coordinates && (
            <Card
              variant="info"
              as="div"
              surface="stable"
              className="location-map-card"
            >
              <h2>Map</h2>
              <div className="map-container">
                <iframe
                  title={`${location.name} Location Map`}
                  width="100%"
                  height="300"
                  className="map-iframe"
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(mapQuery)}`}
                />
              </div>
              <a
                href={`https://www.google.com/maps/search/${encodeURIComponent(
                  location.address
                )},+${encodeURIComponent(location.city)},+${location.state}`}
                target="_blank"
                rel="noopener noreferrer"
                className="info-directions-link"
              >
                Open in Google Maps →
              </a>
            </Card>
          )}
        </div>
      </section>
    </main>
  );
}
