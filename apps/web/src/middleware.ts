import { NextRequest, NextResponse } from 'next/server';
import { seoConfig } from '@/config/seo.config';
import { decodeJwtPayload } from '@/lib/jwt';

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, icons/, images/, og/ (static assets)
     * - api routes handled by Next.js directly
     */
    '/((?!_next/static|_next/image|favicon\\.ico|icons/|images/|og/).*)',
  ],
};

/** Routes staff users are permitted to access under /admin */
const STAFF_PERMITTED_PREFIXES = [
  '/admin/dashboard',
  '/admin/products',
  '/admin/categories',
  '/admin/coa',
  '/admin/login',
] as const;

function getSessionRole(sessionCookie: string): string | null {
  const payload = decodeJwtPayload(sessionCookie);
  if (typeof payload !== 'object' || payload === null) return null;
  const role = (payload as Record<string, unknown>).role;
  return typeof role === 'string' ? role : null;
}

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const { pathname } = url;
  const sessionCookie = request.cookies.get('__session')?.value;

  if (pathname === '/admin') {
    url.pathname = sessionCookie ? '/admin/dashboard' : '/admin/login';
    return NextResponse.redirect(url);
  }

  // 0. Admin auth guard — redirect to login if no session cookie
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!sessionCookie) {
      url.pathname = '/admin/login';
      return NextResponse.redirect(url);
    }

    // Staff role guard — restrict staff to permitted routes only.
    // No Firebase Admin SDK here (Edge Runtime). Payload decode only — no sig verify.
    // Full verification still happens in requireRole() in every Server Action.
    const role = getSessionRole(sessionCookie);
    if (role === 'staff') {
      const isPermitted = STAFF_PERMITTED_PREFIXES.some(prefix =>
        pathname.startsWith(prefix)
      );
      if (!isPermitted) {
        url.pathname = '/admin/products';
        return NextResponse.redirect(url);
      }
    }
  }

  // 1. Legacy redirects (from seoConfig.redirects)
  //    next.config.ts also handles these, but middleware catches them at SSR level
  for (const rule of seoConfig.redirects) {
    if (pathname === rule.source) {
      url.pathname = rule.destination;
      return NextResponse.redirect(url, { status: rule.permanent ? 308 : 307 });
    }
  }

  // 2. Trailing slash — enforce "remove" rule
  if (
    seoConfig.canonicalRules.trailingSlash === 'remove' &&
    pathname !== '/' &&
    pathname.endsWith('/')
  ) {
    url.pathname = pathname.slice(0, -1);
    return NextResponse.redirect(url, { status: 308 });
  }

  // 3. HTTPS enforcement
  if (
    seoConfig.canonicalRules.httpsEnforce &&
    url.protocol === 'http:' &&
    process.env.NODE_ENV === 'production'
  ) {
    url.protocol = 'https:';
    return NextResponse.redirect(url, { status: 308 });
  }

  // 4. www → non-www redirect
  if (
    seoConfig.canonicalRules.wwwRedirect === 'non-www' &&
    url.hostname.startsWith('www.')
  ) {
    url.hostname = url.hostname.slice(4);
    return NextResponse.redirect(url, { status: 308 });
  }

  // 5. Noindex paths — strip any attempt to access admin/api via browser navigation
  //    (actual auth enforcement will be added in Phase 1 admin setup)
  for (const noindexPath of seoConfig.noindex) {
    if (pathname.startsWith(noindexPath) && noindexPath !== '/api') {
      // /api is handled by Next.js route handlers; don't intercept
      // /admin, /verify-age — add X-Robots-Tag header to prevent indexing
      const response = NextResponse.next();
      response.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return response;
    }
  }

  return NextResponse.next();
}
