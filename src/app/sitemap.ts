import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/constants/site';
import { LOCATIONS } from '@/constants/locations';
import { HUB_LOCATION_ID, ONLINE_LOCATION_ID } from '@/constants/location-ids';
import {
  listOnlineAvailableInventory,
  listProductsByIds,
  listVendors,
} from '@/lib/repositories';

/**
 * Public sitemap — served at /sitemap.xml via Next.js App Router convention.
 *
 * Includes:
 *  - Static marketing/legal pages
 *  - Retail location detail pages (virtual hub/online locations excluded)
 *  - Online-visible product detail pages (same filter as Explore More — products
 *    present in inventory/online with inStock: true)
 *  - Active vendor detail pages
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPaths = [
    '/',
    '/about',
    '/products',
    '/locations',
    '/vendors',
    '/contact',
    '/terms',
    '/privacy',
    '/shipping',
  ] as const;

  const staticRoutes: MetadataRoute.Sitemap = staticPaths.map(path => ({
    url: `${SITE_URL}${path === '/' ? '' : path}`,
    lastModified: now,
  }));

  // Retail locations only — exclude virtual inventory-only IDs defensively.
  const virtualLocationIds = new Set<string>([
    HUB_LOCATION_ID,
    ONLINE_LOCATION_ID,
  ]);
  const locationRoutes: MetadataRoute.Sitemap = LOCATIONS.filter(
    loc => !virtualLocationIds.has(loc.slug)
  ).map(loc => ({
    url: `${SITE_URL}/locations/${loc.slug}`,
    lastModified: now,
  }));

  // Online-visible products — matches ExploreMore filter (inventory/online in-stock).
  const onlineInventory = await listOnlineAvailableInventory();
  const onlineProductIds = onlineInventory.map(i => i.productId);
  const onlineProducts = await listProductsByIds(onlineProductIds);
  const productRoutes: MetadataRoute.Sitemap = onlineProducts.map(product => ({
    url: `${SITE_URL}/products/${product.slug}`,
    lastModified: now,
  }));

  const vendors = await listVendors();
  const vendorRoutes: MetadataRoute.Sitemap = vendors.map(vendor => ({
    url: `${SITE_URL}/vendors/${vendor.slug}`,
    lastModified: now,
  }));

  return [
    ...staticRoutes,
    ...locationRoutes,
    ...productRoutes,
    ...vendorRoutes,
  ];
}
