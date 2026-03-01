import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { ReviewsSection } from '../components/ReviewsSection';
import { getLocationBySlug, getLocationSEO } from '../constants/locations';
import { SITE_URL } from '../constants/site';
import { getSocialLink, isSocialIconObject } from '../constants/social';
import { useLocationReviews } from '../hooks/useLocationReviews';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export default function LocationDetail() {
  const { location: slug } = useParams<{ location: string }>();
  const navigate = useNavigate();
  const location = slug ? getLocationBySlug(slug) : null;

  // Redirect if location not found
  useEffect(() => {
    if (!location) {
      navigate('/locations', { replace: true });
    }
  }, [location, navigate]);

  const {
    rating,
    totalRatings,
    reviews,
    status: reviewsStatus,
  } = useLocationReviews(location?.placeId);

  // Update SEO meta tags and JSON-LD schemas (with proper cleanup)
  useEffect(() => {
    if (!location) return;
    if (reviewsStatus === 'loading') return;

    const seo = getLocationSEO(location);
    document.title = seo.title;

    // Helper: Reuse or create meta tags by selector
    const setMeta = (selector: string, content: string) => {
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement('meta');
        if (selector.includes('[property=')) {
          const prop = selector.match(/property="([^"]+)"/)?.[1];
          if (prop) el.setAttribute('property', prop);
        } else {
          const name = selector.match(/name="([^"]+)"/)?.[1];
          if (name) el.setAttribute('name', name);
        }
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    // Update description meta
    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta) descMeta.setAttribute('content', seo.description);

    // Update or create additional meta tags
    setMeta('meta[name="keywords"]', seo.keywords);

    // Open Graph Meta Tags
    setMeta('meta[property="og:title"]', seo.title);
    setMeta('meta[property="og:description"]', seo.description);
    setMeta('meta[property="og:url"]', seo.url);
    setMeta('meta[property="og:image"]', `${SITE_URL}/og-image.png`);
    setMeta('meta[property="og:image:width"]', '1200');
    setMeta('meta[property="og:image:height"]', '630');

    // Twitter Meta Tags
    setMeta('meta[name="twitter:image"]', `${SITE_URL}/twitter-image.png`);

    // Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', seo.url);

    // Remove old location-specific schemas
    const oldSchemas = document.querySelectorAll(
      'script[data-location-schema]'
    );
    oldSchemas.forEach(script => script.remove());

    // LocalBusiness JSON-LD Schema
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: location.name,
      description: location.description,
      address: {
        '@type': 'PostalAddress',
        streetAddress: location.address,
        addressLocality: location.city,
        addressRegion: location.state,
        postalCode: location.zip,
        addressCountry: 'US',
      },
      telephone: location.phone,
      openingHoursSpecification: {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday',
        ],
        opens: '10:00',
        closes: '22:00',
      },
      url: seo.url,
      ...(location.coordinates && {
        geo: {
          '@type': 'GeoCoordinates',
          latitude: location.coordinates.lat,
          longitude: location.coordinates.lng,
        },
      }),
      ...(rating !== null &&
        totalRatings !== null && {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: rating.toFixed(1),
            reviewCount: totalRatings,
            bestRating: '5',
            worstRating: '1',
          },
        }),
    };

    const schemaEl = document.createElement('script');
    schemaEl.setAttribute('type', 'application/ld+json');
    schemaEl.setAttribute('data-location-schema', location.id.toString());
    schemaEl.textContent = JSON.stringify(schema);
    document.head.appendChild(schemaEl);

    // Breadcrumb JSON-LD Schema
    const breadcrumbSchema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: SITE_URL,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Locations',
          item: `${SITE_URL}/locations`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: location.name,
          item: seo.url,
        },
      ],
    };

    const breadcrumbEl = document.createElement('script');
    breadcrumbEl.setAttribute('type', 'application/ld+json');
    breadcrumbEl.setAttribute(
      'data-location-schema',
      `breadcrumb-${location.id}`
    );
    breadcrumbEl.textContent = JSON.stringify(breadcrumbSchema);
    document.head.appendChild(breadcrumbEl);

    // Cleanup: Remove schemas when component unmounts or location changes
    return () => {
      const toRemove = document.querySelectorAll(
        `script[data-location-schema="${location.id}"], script[data-location-schema="breadcrumb-${location.id}"]`
      );
      toRemove.forEach(el => el.remove());
    };
  }, [location, rating, totalRatings, reviewsStatus]);

  if (!location) return null;

  return (
    <main className="location-detail-page">
      <section className="back-to-locations">
        <div className="container">
          <Link to="/locations" className="link-button">
            ← Back to All Locations
          </Link>
        </div>
      </section>

      <section className="location-hero">
        <div className="container">
          <h1>{location.name}</h1>
          <p className="lead">{location.description}</p>
        </div>
      </section>

      <section className="location-info-section">
        <div className="container">
          <div className="location-detail-grid">
            <Card variant="info" as="div">
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

            <Card variant="info" as="div">
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
          </div>
        </div>
      </section>

      {location.coordinates && (
        <section
          className="location-map-section"
          aria-label="Store location map"
        >
          <div className="container">
            <div className="map-container">
              <iframe
                title={`${location.name} Location Map`}
                width="100%"
                height="450"
                style={{ border: 0, borderRadius: '0.75rem' }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(
                  location.placeId
                    ? `place_id:${location.placeId}`
                    : location.coordinates
                      ? `${location.coordinates.lat},${location.coordinates.lng}`
                      : `${location.address}, ${location.city}, ${location.state} ${location.zip}`
                )}`}
              />
            </div>
          </div>
        </section>
      )}

      <ReviewsSection
        rating={rating}
        totalRatings={totalRatings}
        reviews={reviews}
        status={reviewsStatus}
        locationName={location.name}
      />
    </main>
  );
}
