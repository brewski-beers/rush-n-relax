export const dynamic = 'force-dynamic';

import type { MetadataRoute } from 'next';
import { seoConfig } from '@/config/seo.config';
import {
  listLocations,
  listProducts,
  listActivePromos,
} from '@/lib/repositories';

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { site, routes } = seoConfig;

  const [locations, products, promos] = await Promise.all([
    listLocations(),
    listProducts(),
    listActivePromos(),
  ]);

  const staticEntries: MetadataRoute.Sitemap = Object.entries(routes)
    .filter(([path]) => !path.includes('['))
    .map(([path, cfg]) => ({
      url: `${site.domain}${path}`,
      priority: cfg.priority,
      changeFrequency: cfg.changefreq,
      lastModified: new Date(),
    }));

  const locationEntries: MetadataRoute.Sitemap = locations.map(l => ({
    url: `${site.domain}/locations/${l.slug}`,
    priority: routes['/locations/[slug]'].priority,
    changeFrequency: routes['/locations/[slug]'].changefreq,
    lastModified: new Date(),
  }));

  const productEntries: MetadataRoute.Sitemap = products.map(p => ({
    url: `${site.domain}/products/${p.slug}`,
    priority: routes['/products/[slug]'].priority,
    changeFrequency: routes['/products/[slug]'].changefreq,
    lastModified: new Date(),
  }));

  const promoEntries: MetadataRoute.Sitemap = promos.map(p => ({
    url: `${site.domain}/promo/${p.slug}`,
    priority: routes['/promo/[slug]'].priority,
    changeFrequency: routes['/promo/[slug]'].changefreq,
    lastModified: new Date(),
  }));

  return [
    ...staticEntries,
    ...locationEntries,
    ...productEntries,
    ...promoEntries,
  ];
}
