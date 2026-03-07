import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getDownloadURL, ref } from 'firebase/storage';
import { usePromo } from '../hooks/usePromo';
import { getPromoSEO } from '../constants/promos';
import { getLocationBySlug } from '../constants/locations';
import { SITE_URL } from '../constants/site';
import { getStorage$, initializeApp } from '../firebase';
import { Card } from '../components/Card';
import '../styles/promo.css';

export default function Promo() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { promo } = usePromo(slug);
  const [imageSrc, setImageSrc] = useState<string | undefined>();

  useEffect(() => {
    if (!promo) {
      navigate('/', { replace: true });
    }
  }, [promo, navigate]);

  useEffect(() => {
    let cancelled = false;

    const resolveImage = async () => {
      if (!promo?.image) {
        if (!cancelled) setImageSrc(undefined);
        return;
      }

      // If the backend already provides a full URL, use it directly.
      if (/^https?:\/\//i.test(promo.image)) {
        if (!cancelled) setImageSrc(promo.image);
        return;
      }

      try {
        initializeApp();
        const storageRef = ref(getStorage$(), promo.image);
        const downloadUrl = await getDownloadURL(storageRef);
        if (!cancelled) setImageSrc(downloadUrl);
      } catch {
        // Fall back to static/public path for local assets in non-Firebase contexts.
        if (!cancelled) setImageSrc(`/${promo.image}`);
      }
    };

    void resolveImage();

    return () => {
      cancelled = true;
    };
  }, [promo?.image]);

  useEffect(() => {
    if (!promo) return;

    const seo = getPromoSEO(promo);

    document.title = seo.title;

    // Description
    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta) descMeta.setAttribute('content', seo.description);

    // Canonical
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', seo.canonical);

    // og:title
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement('meta');
      ogTitle.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitle);
    }
    ogTitle.setAttribute('content', seo.ogTitle);

    // og:description
    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (!ogDesc) {
      ogDesc = document.createElement('meta');
      ogDesc.setAttribute('property', 'og:description');
      document.head.appendChild(ogDesc);
    }
    ogDesc.setAttribute('content', seo.ogDescription);

    // og:url
    let ogUrl = document.querySelector('meta[property="og:url"]');
    if (!ogUrl) {
      ogUrl = document.createElement('meta');
      ogUrl.setAttribute('property', 'og:url');
      document.head.appendChild(ogUrl);
    }
    ogUrl.setAttribute('content', seo.canonical);

    // og:image
    let ogImage = document.querySelector('meta[property="og:image"]');
    if (!ogImage) {
      ogImage = document.createElement('meta');
      ogImage.setAttribute('property', 'og:image');
      document.head.appendChild(ogImage);
    }
    ogImage.setAttribute('content', seo.ogImage);

    // Remove any existing promo schemas
    document
      .querySelectorAll('script[type="application/ld+json"]')
      .forEach(el => {
        const text = el.textContent ?? '';
        if (
          text.includes('BreadcrumbList') ||
          text.includes('SpecialAnnouncement')
        ) {
          el.remove();
        }
      });

    // BreadcrumbList schema
    const breadcrumbSchema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        {
          '@type': 'ListItem',
          position: 2,
          name: promo.name,
          item: seo.canonical,
        },
      ],
    };

    const breadcrumbEl = document.createElement('script');
    breadcrumbEl.setAttribute('type', 'application/ld+json');
    breadcrumbEl.textContent = JSON.stringify(breadcrumbSchema);
    document.head.appendChild(breadcrumbEl);

    // SpecialAnnouncement schema
    const promoLocation = promo.locationSlug
      ? getLocationBySlug(promo.locationSlug)
      : undefined;
    const announcementSchema = {
      '@context': 'https://schema.org',
      '@type': 'SpecialAnnouncement',
      name: promo.name,
      text: promo.description,
      url: seo.canonical,
      announcementLocation: {
        '@type': 'LocalBusiness',
        name: promoLocation
          ? `Rush N Relax ${promoLocation.name}`
          : 'Rush N Relax',
        url: promoLocation
          ? `${SITE_URL}/locations/${promoLocation.slug}`
          : SITE_URL,
        ...(promoLocation && {
          address: {
            '@type': 'PostalAddress',
            streetAddress: promoLocation.address,
            addressLocality: promoLocation.city,
            addressRegion: promoLocation.state,
            postalCode: promoLocation.zip,
            addressCountry: 'US',
          },
          telephone: promoLocation.phone,
          ...(promoLocation.coordinates && {
            geo: {
              '@type': 'GeoCoordinates',
              latitude: promoLocation.coordinates.lat,
              longitude: promoLocation.coordinates.lng,
            },
          }),
        }),
      },
    };

    const announcementEl = document.createElement('script');
    announcementEl.setAttribute('type', 'application/ld+json');
    announcementEl.textContent = JSON.stringify(announcementSchema);
    document.head.appendChild(announcementEl);

    return () => {
      breadcrumbEl.remove();
      announcementEl.remove();
    };
  }, [promo]);

  if (!promo) return null;

  return (
    <main className="promo-page">
      <section
        id="promo-hero"
        className="promo-hero asymmetry-section-stable page-hero-shell"
      >
        <div className="container promo-hero-inner">
          <p className="promo-kicker">Try In Store</p>
          <h1 className="asymmetry-headline-anchor">{promo.name}</h1>
          <div className="promo-hero-media">
            {imageSrc ? (
              <div className="promo-hero-image-wrap">
                <img
                  src={imageSrc}
                  alt={promo.name}
                  className="promo-hero-image"
                  loading="eager"
                  decoding="async"
                />
              </div>
            ) : (
              <div className="promo-hero-image-fallback" aria-hidden="true" />
            )}
          </div>
          <p className="lead">{promo.tagline}</p>
        </div>
      </section>

      <section
        id="promo-details"
        className="promo-details asymmetry-section-stable"
      >
        <div className="container promo-details-inner">
          <Card
            variant="info"
            as="article"
            surface="anchor"
            elevation="soft"
            motion
            className="promo-detail-card"
          >
            <div className="promo-detail-body">
              <p>{promo.details}</p>
            </div>
          </Card>
        </div>
      </section>

      <section id="promo-cta" className="promo-cta asymmetry-section-anchor">
        <div className="container promo-cta-inner">
          <Link
            to={promo.ctaPath}
            className="btn promo-cta-btn asymmetry-motion-anchor"
          >
            {promo.cta}
          </Link>
        </div>
      </section>
    </main>
  );
}
