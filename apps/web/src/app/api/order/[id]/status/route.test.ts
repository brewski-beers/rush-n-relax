import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getOrderMock } = vi.hoisted(() => ({
  getOrderMock: vi.fn(),
}));

vi.mock('@/lib/repositories', () => ({
  getOrder: getOrderMock,
}));

import { GET } from './route';

function createRequest(): Request {
  return new Request('http://localhost/api/order/abc/status');
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/order/[id]/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with status and Cache-Control: private, max-age=10', async () => {
    getOrderMock.mockResolvedValue({ id: 'abc', status: 'preparing' });

    const res = await GET(createRequest(), makeParams('abc'));

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=10');
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('preparing');
  });

  it('returns 404 with Cache-Control header when order is missing', async () => {
    getOrderMock.mockResolvedValue(null);

    const res = await GET(createRequest(), makeParams('missing'));

    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=10');
  });
});
