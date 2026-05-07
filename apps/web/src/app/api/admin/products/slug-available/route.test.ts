import { beforeEach, describe, expect, it, vi } from 'vitest';

const { verifySessionCookieMock, getProductBySlugMock, cookiesMock } =
  vi.hoisted(() => ({
    verifySessionCookieMock: vi.fn(),
    getProductBySlugMock: vi.fn(),
    cookiesMock: vi.fn(),
  }));

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}));

vi.mock('@/lib/firebase/admin', () => ({
  getAdminAuth: () => ({ verifySessionCookie: verifySessionCookieMock }),
}));

vi.mock('@/lib/repositories', () => ({
  getProductBySlug: getProductBySlugMock,
}));

import { GET } from './route';

function withSession(value: string | undefined) {
  cookiesMock.mockResolvedValue({
    get: (name: string) =>
      name === '__session' && value ? { value } : undefined,
  });
}

function req(slug: string | null): Request {
  const url = new URL('http://localhost/api/admin/products/slug-available');
  if (slug !== null) url.searchParams.set('slug', slug);
  return new Request(url, { method: 'GET' });
}

describe('GET /api/admin/products/slug-available', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Auth ------------------------------------------------------------------

  it('returns 401 when no session cookie is present', async () => {
    // Given no session cookie
    withSession(undefined);

    // When the endpoint is called
    const res = await GET(req('foo'));

    // Then 401 is returned and no lookup runs
    expect(res.status).toBe(401);
    expect(getProductBySlugMock).not.toHaveBeenCalled();
  });

  it('returns 401 when session cookie verification throws', async () => {
    withSession('bad-cookie');
    verifySessionCookieMock.mockRejectedValue(new Error('revoked'));

    const res = await GET(req('foo'));

    expect(res.status).toBe(401);
    expect(getProductBySlugMock).not.toHaveBeenCalled();
  });

  it('returns 403 when role claim is below staff', async () => {
    // Given a verified session for a customer
    withSession('valid');
    verifySessionCookieMock.mockResolvedValue({
      uid: 'u1',
      role: 'customer',
    });

    // When the endpoint is called
    const res = await GET(req('foo'));

    // Then 403 is returned
    expect(res.status).toBe(403);
    expect(getProductBySlugMock).not.toHaveBeenCalled();
  });

  it('returns 403 when no role claim is present', async () => {
    withSession('valid');
    verifySessionCookieMock.mockResolvedValue({ uid: 'u1' });

    const res = await GET(req('foo'));

    expect(res.status).toBe(403);
  });

  // Validation ------------------------------------------------------------

  it('returns 400 when slug is missing', async () => {
    withSession('valid');
    verifySessionCookieMock.mockResolvedValue({ uid: 'u1', role: 'staff' });

    const res = await GET(req(null));

    expect(res.status).toBe(400);
    expect(getProductBySlugMock).not.toHaveBeenCalled();
  });

  it('returns 400 when slug has invalid characters', async () => {
    withSession('valid');
    verifySessionCookieMock.mockResolvedValue({ uid: 'u1', role: 'staff' });

    const res = await GET(req('Invalid Slug!'));

    expect(res.status).toBe(400);
  });

  // Happy path ------------------------------------------------------------

  it('returns { available: true } when no product exists at that slug', async () => {
    // Given an authenticated staff caller and no product at the slug
    withSession('valid');
    verifySessionCookieMock.mockResolvedValue({ uid: 'u1', role: 'staff' });
    getProductBySlugMock.mockResolvedValue(null);

    // When the endpoint is called with a free slug
    const res = await GET(req('free-slug'));

    // Then 200 + { available: true }
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ available: true });
    expect(getProductBySlugMock).toHaveBeenCalledWith('free-slug');
  });

  it('returns { available: false } when a product already exists at that slug', async () => {
    withSession('valid');
    verifySessionCookieMock.mockResolvedValue({ uid: 'u1', role: 'owner' });
    getProductBySlugMock.mockResolvedValue({ slug: 'taken' });

    const res = await GET(req('taken'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ available: false });
  });

  it('sets Cache-Control: no-store on 200 responses', async () => {
    withSession('valid');
    verifySessionCookieMock.mockResolvedValue({ uid: 'u1', role: 'staff' });
    getProductBySlugMock.mockResolvedValue(null);

    const res = await GET(req('fresh'));

    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});
