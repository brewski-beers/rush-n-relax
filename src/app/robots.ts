import type { MetadataRoute } from 'next';
import { seoConfig } from '@/config/seo.config';

export default function robots(): MetadataRoute.Robots {
  const { site, noindex } = seoConfig;

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: noindex,
      },
    ],
    sitemap: `${site.domain}/sitemap.xml`,
    host: site.domain,
  };
}
