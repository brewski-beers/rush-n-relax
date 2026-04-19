/**
 * Single source of truth for all routes and their required sections.
 * Health checks and drift detection consume this directly.
 *
 * NOTE: Location routes are defined inline to avoid importing locations.ts,
 * which has SVG dependencies that break Node.js test runners (Playwright).
 * Keep LOCATION_ROUTES in sync with LOCATIONS in locations.ts.
 *
 * When adding a new page:
 * 1. Add the route and its section IDs to ROUTE_SECTIONS
 * 2. Add the page component name to PAGE_TO_ROUTE
 * 3. Drift detection tests will fail until both are done
 */

export const ROUTE_SECTIONS = {
  '/': ['hero', 'story', 'products-preview', 'locations'],
  '/about': ['about-hero', 'experience', 'mission', 'values', 'team', 'cta'],
  '/locations': ['locations-hero', 'locations-list', 'cta'],
  '/contact': ['contact-hero', 'contact-form-section', 'location-contact'],
  '/products': ['products-hero', 'products-grid'],
  '/vendors': ['vendors-hero', 'vendors-directory'],
} as const;

export type RoutePath = keyof typeof ROUTE_SECTIONS;
export type SectionId = (typeof ROUTE_SECTIONS)[RoutePath][number];

export const STATIC_ROUTES = Object.keys(ROUTE_SECTIONS) as RoutePath[];

/**
 * Maps App Router page.tsx paths (relative to src/app/(storefront)/) to routes.
 * 'index' refers to the root page.tsx. Used by drift detection.
 *
 * When adding a new page:
 * 1. Add the route and its section IDs to ROUTE_SECTIONS (if static)
 * 2. Add the App Router key here
 * 3. Drift detection tests will fail until both are done
 *
 * Values:
 * - RoutePath string: Static route
 * - 'dynamic': Parameterized route (e.g., /locations/[slug])
 */
export const PAGE_TO_ROUTE: Record<string, RoutePath | 'dynamic'> = {
  index: '/',
  about: '/about',
  locations: '/locations',
  'locations/[slug]': 'dynamic',
  products: '/products',
  'products/[slug]': 'dynamic',
  contact: '/contact',
  cart: 'dynamic',
  'order/[id]': 'dynamic',
  'promo/[slug]': 'dynamic',
  vendors: '/vendors',
  'vendors/[slug]': 'dynamic',
  terms: 'dynamic',
  privacy: 'dynamic',
  shipping: 'dynamic',
};

/**
 * Dynamic routes derived from location data.
 * Keep in sync with LOCATIONS in locations.ts.
 */
export const LOCATION_ROUTES = [
  {
    path: '/locations/oak-ridge' as const,
    label: 'Pinecrest',
    slug: 'oak-ridge',
  },
  {
    path: '/locations/maryville' as const,
    label: 'Bluffton',
    slug: 'maryville',
  },
  { path: '/locations/seymour' as const, label: 'Hartwell', slug: 'seymour' },
  {
    path: '/locations/crestwood' as const,
    label: 'Crestwood Station',
    slug: 'crestwood',
  },
  {
    path: '/locations/thornvale' as const,
    label: 'Thornvale',
    slug: 'thornvale',
  },
  { path: '/locations/lakemoor' as const, label: 'Lakemoor', slug: 'lakemoor' },
  {
    path: '/locations/dunmore' as const,
    label: 'Dunmore Crossing',
    slug: 'dunmore',
  },
  { path: '/locations/ashby' as const, label: 'Ashby Flats', slug: 'ashby' },
  { path: '/locations/veldora' as const, label: 'Veldora', slug: 'veldora' },
  { path: '/locations/graymere' as const, label: 'Graymere', slug: 'graymere' },
];

/**
 * All testable routes for health checks (static + dynamic instances).
 */
export const ALL_TESTABLE_ROUTES = [
  ...STATIC_ROUTES,
  ...LOCATION_ROUTES.map(r => r.path),
];
