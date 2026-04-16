/**
 * Central SEO configuration — single source of truth for all SEO behaviour.
 * Middleware, metadata factories, sitemap, and robots.txt all read from here.
 *
 * Open/Closed principle:
 *   ADD new routes/rules by appending to the relevant section.
 *   NEVER modify existing entries — extend only.
 */

export type RouteConfig = {
  title?: string;
  priority: number;
  changefreq:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never';
  noindexWhenExpired?: boolean;
};

export type SeoConfig = {
  site: {
    name: string;
    domain: string;
    titleTemplate: string;
    defaultTitle: string;
    defaultDescription: string;
    defaultOgImage: string;
    twitterHandle: string;
    locale: string;
  };
  routes: Record<string, RouteConfig>;
  noindex: string[];
  canonicalRules: {
    trailingSlash: 'remove' | 'add';
    wwwRedirect: 'non-www' | 'www';
    httpsEnforce: boolean;
  };
  redirects: Array<{
    source: string;
    destination: string;
    permanent: boolean;
  }>;
  structuredData: Record<string, string[]>;
};

export const seoConfig = {
  site: {
    name: 'Rush N Relax',
    domain: 'https://rushnrelax.com',
    titleTemplate: '%s | Rush N Relax',
    defaultTitle: 'Rush N Relax — Premium Cannabis Dispensary in Tennessee',
    defaultDescription:
      "East Tennessee's upscale cannabis dispensary and speakeasy-style lounge. Premium flower, concentrates, edibles, vapes & THCa drinks in Oak Ridge, Maryville, and Seymour.",
    defaultOgImage: '/og/default.jpg',
    twitterHandle: '@rushnrelax',
    locale: 'en_US',
  },

  routes: {
    '/': { title: 'Home', priority: 1.0, changefreq: 'daily' },
    '/about': { title: 'About Us', priority: 0.8, changefreq: 'monthly' },
    '/locations': {
      title: 'Dispensary Locations in TN',
      priority: 0.9,
      changefreq: 'weekly',
    },
    '/products': {
      title: 'Cannabis Products',
      priority: 0.9,
      changefreq: 'weekly',
    },
    '/contact': { title: 'Contact Us', priority: 0.7, changefreq: 'monthly' },
    '/locations/[slug]': { priority: 0.9, changefreq: 'weekly' },
    '/products/[slug]': { priority: 0.85, changefreq: 'weekly' },
    '/promo/[slug]': {
      priority: 0.7,
      changefreq: 'daily',
      noindexWhenExpired: true,
    },
  },

  noindex: ['/admin', '/api', '/verify-age'],

  canonicalRules: {
    trailingSlash: 'remove',
    wwwRedirect: 'non-www',
    httpsEnforce: true,
  },

  redirects: [
    { source: '/home', destination: '/', permanent: true },
    { source: '/reviews', destination: '/', permanent: true },
  ],

  structuredData: {
    '/': ['WebSite', 'Organization'],
    '/locations': ['ItemList'],
    '/locations/[slug]': ['LocalBusiness', 'BreadcrumbList'],
    '/products/[slug]': ['Product', 'BreadcrumbList'],
    '/promo/[slug]': ['Offer', 'BreadcrumbList'],
  },
} as const satisfies SeoConfig;
