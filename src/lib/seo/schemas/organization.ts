import { seoConfig } from '@/config/seo.config';

/** WebSite + SearchAction schema for the homepage */
export function buildWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: seoConfig.site.name,
    url: seoConfig.site.domain,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${seoConfig.site.domain}/products?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/** Organization schema — used on homepage and shared pages */
export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: seoConfig.site.name,
    url: seoConfig.site.domain,
    logo: `${seoConfig.site.domain}/icons/logo.png`,
    sameAs: [
      'https://www.facebook.com/rushnrelax',
      'https://www.instagram.com/rushnrelax',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: 'English',
    },
  };
}
