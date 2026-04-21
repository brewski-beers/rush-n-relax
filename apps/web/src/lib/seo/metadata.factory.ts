/**
 * SEO metadata factory — single entry point for all Next.js Metadata objects.
 *
 * Every page's generateMetadata() calls buildMetadata(). No page constructs
 * Metadata directly. This enforces the open/closed pattern from seoConfig:
 * adding a new route = add one config entry, factory handles the rest.
 */
import type { Metadata } from 'next';
import { seoConfig, type RouteConfig } from '@/config/seo.config';

export interface MetadataOverrides {
  title?: string;
  description?: string;
  canonical?: string;
  /** Absolute URL for OG/Twitter image */
  ogImage?: string;
  ogType?: 'website' | 'article';
  /** Set to true for expired promos, /admin, /api paths */
  noindex?: boolean;
  /** Optional path to build the canonical URL from site.domain if canonical not given */
  path?: string;
}

/**
 * Build a Next.js Metadata object for any route.
 *
 * @param routePattern - key from seoConfig.routes (e.g. '/locations/[slug]')
 * @param overrides    - per-page overrides merged on top of route defaults
 */
export function buildMetadata(
  routePattern: string,
  overrides: MetadataOverrides = {}
): Metadata {
  const routeCfg = seoConfig.routes[
    routePattern as keyof typeof seoConfig.routes
  ] as RouteConfig | undefined;
  const { site } = seoConfig;

  const title = overrides.title ?? routeCfg?.title ?? site.defaultTitle;
  const description = overrides.description ?? site.defaultDescription;
  const canonical =
    overrides.canonical ??
    (overrides.path ? `${site.domain}${overrides.path}` : site.domain);
  const ogImage = overrides.ogImage ?? site.defaultOgImage;

  const robots = overrides.noindex
    ? { index: false, follow: false }
    : { index: true, follow: true, googleBot: { index: true, follow: true } };

  return {
    title: { template: site.titleTemplate, default: title },
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: site.name,
      locale: site.locale,
      type: overrides.ogType ?? 'website',
      images: [
        {
          url: ogImage.startsWith('http')
            ? ogImage
            : `${site.domain}${ogImage}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: site.twitterHandle,
      title,
      description,
      images: [
        ogImage.startsWith('http') ? ogImage : `${site.domain}${ogImage}`,
      ],
    },
    robots,
  };
}
