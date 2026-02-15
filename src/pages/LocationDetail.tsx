import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Navigation } from '../components/Navigation';
import { Footer } from '../components/Footer';
import { getLocationBySlug, getLocationSEO } from '../constants/locations';

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

  // Update SEO meta tags
  useEffect(() => {
    if (!location) return;

    const seo = getLocationSEO(location);
    document.title = seo.title;

    // Description
    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta) descMeta.setAttribute('content', seo.description);

    // Keywords
    let keywordsMeta = document.querySelector('meta[name="keywords"]');
    if (!keywordsMeta) {
      keywordsMeta = document.createElement('meta');
      keywordsMeta.setAttribute('name', 'keywords');
      document.head.appendChild(keywordsMeta);
    }
    keywordsMeta.setAttribute('content', seo.keywords);

    // Open Graph
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement('meta');
      ogTitle.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitle);
    }
    ogTitle.setAttribute('content', seo.title);

    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (!ogDesc) {
      ogDesc = document.createElement('meta');
      ogDesc.setAttribute('property', 'og:description');
      document.head.appendChild(ogDesc);
    }
    ogDesc.setAttribute('content', seo.description);

    let ogUrl = document.querySelector('meta[property="og:url"]');
    if (!ogUrl) {
      ogUrl = document.createElement('meta');
      ogUrl.setAttribute('property', 'og:url');
      document.head.appendChild(ogUrl);
    }
    ogUrl.setAttribute('content', seo.url);

    // og:image for social sharing
    let ogImage = document.querySelector('meta[property="og:image"]');
    if (!ogImage) {
      ogImage = document.createElement('meta');
      ogImage.setAttribute('property', 'og:image');
      document.head.appendChild(ogImage);
    }
    ogImage.setAttribute('content', 'https://www.rushnrelax.com/og-image.png');

    let ogImageWidth = document.querySelector('meta[property="og:image:width"]');
    if (!ogImageWidth) {
      ogImageWidth = document.createElement('meta');
      ogImageWidth.setAttribute('property', 'og:image:width');
      document.head.appendChild(ogImageWidth);
    }
    ogImageWidth.setAttribute('content', '1200');

    let ogImageHeight = document.querySelector('meta[property="og:image:height"]');
    if (!ogImageHeight) {
      ogImageHeight = document.createElement('meta');
      ogImageHeight.setAttribute('property', 'og:image:height');
      document.head.appendChild(ogImageHeight);
    }
    ogImageHeight.setAttribute('content', '630');

    // Twitter image
    let twitterImage = document.querySelector('meta[name="twitter:image"]');
    if (!twitterImage) {
      twitterImage = document.createElement('meta');
      twitterImage.setAttribute('name', 'twitter:image');
      document.head.appendChild(twitterImage);
    }
    twitterImage.setAttribute('content', 'https://www.rushnrelax.com/twitter-image.png');

    // Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', seo.url);

    // Remove old location schemas (LocalBusiness and Breadcrumb)
    const existingSchemas = document.querySelectorAll('script[type="application/ld+json"]');
    existingSchemas.forEach((script) => {
      const content = script.textContent;
      if (content && (content.includes('LocalBusiness') || content.includes('BreadcrumbList'))) {
        script.remove();
      }
    });

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
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
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
    };

    const schemaEl = document.createElement('script');
    schemaEl.setAttribute('type', 'application/ld+json');
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
          item: 'https://www.rushnrelax.com',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Locations',
          item: 'https://www.rushnrelax.com/locations',
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
    breadcrumbEl.textContent = JSON.stringify(breadcrumbSchema);
    document.head.appendChild(breadcrumbEl);
  }, [location]);

  if (!location) return null;

  return (
    <>
      <Navigation />
      <main className="location-detail-page">
        <section className="location-hero">
          <div className="container">
            <h1>{location.name}</h1>
            <p className="lead">{location.description}</p>
          </div>
        </section>

        <section className="location-info-section">
          <div className="container">
            <div className="location-detail-grid">
              <div className="info-card glass">
                <h2>Address</h2>
                <address>
                  <p>{location.address}</p>
                  <p>
                    {location.city}, {location.state} {location.zip}
                  </p>
                </address>
              </div>

              <div className="info-card glass">
                <h2>Hours</h2>
                <p>{location.hours}</p>
                <p className="text-secondary">Open 7 days a week</p>
              </div>

              <div className="info-card glass">
                <h2>Call Us</h2>
                <a href={`tel:${location.phone.replace(/\D/g, '')}`} className="phone-link">
                  {location.phone}
                </a>
                <p className="text-secondary">Available during business hours</p>
              </div>

              {location.coordinates && (
                <div className="info-card glass">
                  <h2>Location</h2>
                  <p>
                    <strong>{location.city}, {location.state}</strong>
                  </p>
                  <p className="text-secondary">
                    Coordinates: {location.coordinates.lat}, {location.coordinates.lng}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {location.coordinates && (
          <section className="location-map-section">
            <div className="container">
              <h2>Find Us on the Map</h2>
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
                    `${location.address}, ${location.city}, ${location.state} ${location.zip}`
                  )}`}
                />
              </div>
              <div className="map-actions">
                <a
                  href={`https://www.google.com/maps/search/${encodeURIComponent(
                    location.address
                  )},+${encodeURIComponent(location.city)},+${location.state}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                >
                  Get Directions
                </a>
              </div>
            </div>
          </section>
        )}

        <section className="location-cta">
          <div className="container">
            <h2>Visit Us Today</h2>
            <p>Experience premium cannabis in our upscale lounge atmosphere.</p>
            <div className="cta-buttons">
              <a href={`tel:${location.phone.replace(/\D/g, '')}`} className="btn btn-primary">
                Call Now
              </a>
              <a href="/contact" className="btn btn-secondary">
                Schedule Visit
              </a>
            </div>
          </div>
        </section>

        <section className="back-to-locations">
          <div className="container">
            <a href="/locations" className="link-button">
              ← Back to All Locations
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
