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
} as const;

export type RoutePath = keyof typeof ROUTE_SECTIONS;
export type SectionId = (typeof ROUTE_SECTIONS)[RoutePath][number];

export const STATIC_ROUTES = Object.keys(ROUTE_SECTIONS) as RoutePath[];

/**
 * Maps page component filenames to their route paths.
 * Used by drift detection to ensure all pages are routed.
 *
 * Values:
 * - RoutePath string: Static route
 * - 'dynamic': Parameterized route (e.g., /locations/:slug)
 */
export const PAGE_TO_ROUTE: Record<string, RoutePath | 'dynamic'> = {
  Home: '/',
  About: '/about',
  Locations: '/locations',
  LocationDetail: 'dynamic',
  Products: '/products',
  ProductDetail: 'dynamic',
  Contact: '/contact',
};

/**
 * Dynamic routes derived from location data.
 * Keep in sync with LOCATIONS in locations.ts.
 */
export const LOCATION_ROUTES = [
  {
    path: '/locations/oak-ridge' as const,
    label: 'Oak Ridge',
    slug: 'oak-ridge',
  },
  {
    path: '/locations/maryville' as const,
    label: 'Maryville',
    slug: 'maryville',
  },
  { path: '/locations/seymour' as const, label: 'Seymour', slug: 'seymour' },
];

/**
 * All testable routes for health checks (static + dynamic instances).
 */
export const ALL_TESTABLE_ROUTES = [
  ...STATIC_ROUTES,
  ...LOCATION_ROUTES.map(r => r.path),
];
