/**
 * LocalBusiness schema factory.
 * Used on location detail pages (/locations/[slug]).
 * Schema.org type validated against complianceConfig.allowedSchemaTypes.
 */
import { seoConfig } from '@/config/seo.config';
import type { Location } from '@/types';

export function buildLocalBusinessSchema(location: Location) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: `Rush N Relax — ${location.name}`,
    url: `${seoConfig.site.domain}/locations/${location.slug}`,
    telephone: location.phone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: location.address,
      addressLocality: location.city,
      addressRegion: location.state,
      postalCode: location.zip,
      addressCountry: 'US',
    },
    ...(location.coordinates && {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: location.coordinates.lat,
        longitude: location.coordinates.lng,
      },
    }),
    openingHours: location.hours,
    priceRange: '$$',
    image: location.ogImagePath
      ? `${seoConfig.site.domain}/${location.ogImagePath}`
      : `${seoConfig.site.domain}${seoConfig.site.defaultOgImage}`,
    description: location.seoDescription ?? location.description,
    parentOrganization: {
      '@type': 'Organization',
      name: 'Rush N Relax',
      url: seoConfig.site.domain,
    },
  };
}
