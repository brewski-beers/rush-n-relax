import type { MetadataRoute } from 'next';
import { seoConfig } from '@/config/seo.config';
import {
  listLocations,
  listProducts,
  listActivePromos,
} from '@/lib/repositories';

const { domain } = seoConfig.site;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [locations, products, promos] = await Promise.all([
    listLocations(),
    listProducts(),
    listActivePromos(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: domain,
      priority: seoConfig.routes['/'].priority,
      changeFrequency: seoConfig.routes['/'].changefreq,
    },
    {
      url: `${domain}/about`,
      priority: seoConfig.routes['/about'].priority,
      changeFrequency: seoConfig.routes['/about'].changefreq,
    },
    {
      url: `${domain}/locations`,
      priority: seoConfig.routes['/locations'].priority,
      changeFrequency: seoConfig.routes['/locations'].changefreq,
    },
    {
      url: `${domain}/products`,
      priority: seoConfig.routes['/products'].priority,
      changeFrequency: seoConfig.routes['/products'].changefreq,
    },
    {
      url: `${domain}/contact`,
      priority: seoConfig.routes['/contact'].priority,
      changeFrequency: seoConfig.routes['/contact'].changefreq,
    },
  ];

  const locationRoutes: MetadataRoute.Sitemap = locations.map(loc => ({
    url: `${domain}/locations/${loc.slug}`,
    lastModified: new Date(),
    priority: seoConfig.routes['/locations/[slug]'].priority,
    changeFrequency: seoConfig.routes['/locations/[slug]'].changefreq,
  }));

  const productRoutes: MetadataRoute.Sitemap = products.map(product => ({
    url: `${domain}/products/${product.slug}`,
    lastModified: new Date(),
    priority: seoConfig.routes['/products/[slug]'].priority,
    changeFrequency: seoConfig.routes['/products/[slug]'].changefreq,
  }));

  const promoRoutes: MetadataRoute.Sitemap = promos.map(promo => ({
    url: `${domain}/promo/${promo.slug}`,
    lastModified: new Date(),
    priority: seoConfig.routes['/promo/[slug]'].priority,
    changeFrequency: seoConfig.routes['/promo/[slug]'].changefreq,
  }));

  return [...staticRoutes, ...locationRoutes, ...productRoutes, ...promoRoutes];
}
