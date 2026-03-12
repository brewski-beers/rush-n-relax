import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';
import {
  PAGE_TO_ROUTE,
  ROUTE_SECTIONS,
  STATIC_ROUTES,
  LOCATION_ROUTES,
} from './routes';
import { LOCATIONS } from './locations';

/**
 * Drift Detection Tests
 *
 * These tests ensure that:
 * 1. Every page.tsx in the App Router storefront has a route mapping
 * 2. Every route mapping points to an existing App Router page
 * 3. All static routes have section definitions
 *
 * If any of these fail, it means the routes config is out of sync
 * with the actual codebase.
 */

/**
 * Recursively find all page.tsx files under a directory.
 * Returns route keys relative to the storefront root:
 *   - Root page.tsx → 'index'
 *   - about/page.tsx → 'about'
 *   - locations/[slug]/page.tsx → 'locations/[slug]'
 */
function collectAppRouterKeys(dir: string, baseDir: string = dir): string[] {
  const entries = readdirSync(dir);
  const keys: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (!entry.startsWith('_') && !entry.startsWith('.')) {
        keys.push(...collectAppRouterKeys(fullPath, baseDir));
      }
    } else if (entry === 'page.tsx') {
      const relative =
        dir === baseDir ? 'index' : dir.slice(baseDir.length + 1);
      keys.push(relative);
    }
  }

  return keys;
}

describe('Routes Configuration', () => {
  describe('drift detection', () => {
    const storefrontDir = resolve(__dirname, '../app/(storefront)');
    const appRouterKeys = collectAppRouterKeys(storefrontDir);
    const mappedPages = Object.keys(PAGE_TO_ROUTE);

    it('all page components have route mappings', () => {
      for (const key of appRouterKeys) {
        expect(
          mappedPages,
          `App Router page "${key}/page.tsx" exists but has no entry in PAGE_TO_ROUTE. Add it to src/constants/routes.ts`
        ).toContain(key);
      }
    });

    it('all route mappings point to existing page components', () => {
      for (const page of mappedPages) {
        expect(
          appRouterKeys,
          `PAGE_TO_ROUTE contains "${page}" but no page.tsx exists at src/app/(storefront)/${page === 'index' ? '' : page + '/'}`
        ).toContain(page);
      }
    });

    it('all static routes have section definitions', () => {
      for (const route of STATIC_ROUTES) {
        expect(
          ROUTE_SECTIONS[route],
          `Route "${route}" is in STATIC_ROUTES but has no section definitions in ROUTE_SECTIONS`
        ).toBeDefined();
        expect(
          ROUTE_SECTIONS[route].length,
          `Route "${route}" has empty section definitions — add at least one section ID`
        ).toBeGreaterThan(0);
      }
    });

    it('all ROUTE_SECTIONS keys are in STATIC_ROUTES', () => {
      const sectionKeys = Object.keys(ROUTE_SECTIONS).sort();
      const staticRoutes = [...STATIC_ROUTES].sort();
      expect(sectionKeys).toEqual(staticRoutes);
    });
  });

  describe('data integrity', () => {
    it('PAGE_TO_ROUTE covers all static routes', () => {
      const staticRoutesFromPages = Object.values(PAGE_TO_ROUTE).filter(
        v => v !== 'dynamic'
      );

      for (const route of STATIC_ROUTES) {
        expect(
          staticRoutesFromPages,
          `Static route "${route}" has no page mapping in PAGE_TO_ROUTE`
        ).toContain(route);
      }
    });

    it('no duplicate routes in PAGE_TO_ROUTE', () => {
      const routes = Object.values(PAGE_TO_ROUTE).filter(v => v !== 'dynamic');
      const uniqueRoutes = new Set(routes);
      expect(routes.length).toBe(uniqueRoutes.size);
    });

    it('LOCATION_ROUTES matches LOCATIONS slugs and names', () => {
      const locationSlugs = LOCATIONS.map(loc => loc.slug).sort();
      const routeSlugs = LOCATION_ROUTES.map(r => r.slug).sort();

      expect(
        routeSlugs,
        'LOCATION_ROUTES is out of sync with LOCATIONS. Update src/constants/routes.ts'
      ).toEqual(locationSlugs);

      for (const loc of LOCATIONS) {
        const route = LOCATION_ROUTES.find(r => r.slug === loc.slug);
        expect(
          route?.label,
          `LOCATION_ROUTES label for "${loc.slug}" doesn't match LOCATIONS name`
        ).toBe(loc.name);
      }
    });
  });
});
