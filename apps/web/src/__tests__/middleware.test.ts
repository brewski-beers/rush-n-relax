import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/** Build a minimal JWT string from a payload object (no real signature). */
function buildJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

function buildRequest(pathname: string, sessionJwt?: string): NextRequest {
  const url = `http://localhost${pathname}`;
  const req = new NextRequest(url);
  if (sessionJwt) {
    req.cookies.set('__session', sessionJwt);
  }
  return req;
}

// Mock seoConfig to keep middleware tests focused on auth logic only
vi.mock('@/config/seo.config', () => ({
  seoConfig: {
    redirects: [],
    canonicalRules: {
      trailingSlash: 'remove',
      httpsEnforce: false,
      wwwRedirect: 'non-www',
    },
    noindex: ['/admin'],
  },
}));

import { middleware } from '@/middleware';

describe('middleware — staff route guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects staff from /admin/users to /admin/products', () => {
    const staffJwt = buildJwt({ role: 'staff' });
    const req = buildRequest('/admin/users', staffJwt);

    const response = middleware(req);

    expect(response?.status).toBeGreaterThanOrEqual(300);
    expect(response?.headers.get('location')).toContain('/admin/products');
  });

  it('allows staff to access /admin/products/new', () => {
    const staffJwt = buildJwt({ role: 'staff' });
    const req = buildRequest('/admin/products/new', staffJwt);

    const response = middleware(req);

    // Should not redirect to /admin/products — either next() or noindex header
    const location = response?.headers.get('location') ?? '';
    expect(location).not.toContain('/admin/products');
  });

  it('allows staff to access /admin/coa', () => {
    const staffJwt = buildJwt({ role: 'staff' });
    const req = buildRequest('/admin/coa', staffJwt);

    const response = middleware(req);

    const location = response?.headers.get('location') ?? '';
    expect(location).not.toContain('/admin/products');
  });

  it('allows owner to access /admin/users without redirect', () => {
    const ownerJwt = buildJwt({ role: 'owner' });
    const req = buildRequest('/admin/users', ownerJwt);

    const response = middleware(req);

    const location = response?.headers.get('location') ?? '';
    expect(location).not.toContain('/admin/products');
  });

  it('treats malformed JWT payload as no role — falls through to cookie-presence guard', () => {
    // Malformed JWT — decodeJwtPayload returns null; role treated as absent.
    // The path is an admin route and a cookie is present (so cookie-presence guard passes),
    // but role is unknown so non-owner, non-staff treatment applies (no crash, no throw).
    const malformedJwt = 'not.valid.jwt!!!';
    const req = buildRequest('/admin/inventory', malformedJwt);

    // Middleware should not throw
    expect(() => middleware(req)).not.toThrow();
  });
});
