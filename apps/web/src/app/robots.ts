import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/constants/site';

/**
 * Public robots.txt — served at /robots.txt via Next.js App Router convention.
 * Disallows internal/admin paths and the checkout stub bridge.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api', '/checkout/stub'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
