import { describe, expect, it } from 'vitest';
import { isRouteActive } from './routeMatching';

describe('isRouteActive', () => {
  it('matches root only when current path is root', () => {
    expect(isRouteActive('/', '/')).toBe(true);
    expect(isRouteActive('/about', '/')).toBe(false);
  });

  it('matches exact non-root routes', () => {
    expect(isRouteActive('/products', '/products')).toBe(true);
    expect(isRouteActive('/contact', '/products')).toBe(false);
  });

  it('matches nested routes under a section', () => {
    expect(isRouteActive('/products/flower', '/products')).toBe(true);
    expect(isRouteActive('/locations/downtown', '/locations')).toBe(true);
  });

  it('normalizes trailing slashes for both current and target paths', () => {
    expect(isRouteActive('/products/', '/products')).toBe(true);
    expect(isRouteActive('/products', '/products/')).toBe(true);
    expect(isRouteActive('/products/flower/', '/products/')).toBe(true);
  });

  it('does not match partial prefix collisions', () => {
    expect(isRouteActive('/productivity', '/products')).toBe(false);
    expect(isRouteActive('/locations-map', '/locations')).toBe(false);
  });
});
