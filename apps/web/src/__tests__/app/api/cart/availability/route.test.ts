import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { getAllMock } = vi.hoisted(() => ({
  getAllMock: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({
  getAdminFirestore: () => ({
    collection: (path: string) => ({
      doc: (id: string) => ({ _path: path, id }),
    }),
    getAll: getAllMock,
  }),
}));

// Stub LOCATION_SLUGS to retail + online so tests are deterministic
vi.mock('@/lib/fixtures/storefront', () => ({
  LOCATION_SLUGS: ['oak-ridge', 'maryville', 'seymour', 'online'],
}));

import { GET } from '@/app/api/cart/availability/route';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(itemsParam?: string): NextRequest {
  const url =
    itemsParam !== undefined
      ? `http://localhost/api/cart/availability?items=${encodeURIComponent(itemsParam)}`
      : 'http://localhost/api/cart/availability';
  return new NextRequest(url);
}

interface LocOverride {
  qty?: number;
  reserved?: number;
  availablePickup?: boolean;
}

// Build a product Firestore document with unified `variants` entries per
// location (#397 step 2 — unified variants map).
function makeProductData(
  variantId: string,
  perLocation: Partial<Record<string, LocOverride | null>>
) {
  const locations: Record<string, unknown> = {};
  for (const [slug, override] of Object.entries(perLocation)) {
    if (override === null) continue;
    const o = override ?? {};
    locations[slug] = {
      qty: o.qty ?? 10,
      ...(o.reserved !== undefined && { reserved: o.reserved }),
      price: 1000,
      ...(o.availablePickup !== undefined && {
        availablePickup: o.availablePickup,
      }),
    };
  }
  return {
    variants: {
      [variantId]: {
        label: variantId,
        locations,
      },
    },
  };
}

function makeSnap(data: Record<string, unknown> | null) {
  if (data === null) return { exists: false, data: () => ({}), id: 'flower' };
  return { exists: true, data: () => data, id: 'flower' };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/cart/availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given no items param in the request', () => {
    it('returns 400 with Missing items param error', async () => {
      const res = await GET(makeRequest());
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('Missing items param');
    });
  });

  describe('given items param with an empty array', () => {
    it('returns 400 with Cart is empty error', async () => {
      const res = await GET(makeRequest('[]'));
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('Cart is empty');
    });
  });

  describe('given items param with invalid JSON', () => {
    it('returns 400 with Invalid items param error', async () => {
      const res = await GET(makeRequest('not-json'));
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('Invalid items param');
    });
  });

  describe('given a cart item whose product has no variant entry at a location', () => {
    it('marks that location unavailable with the productId in unavailableItems', async () => {
      // oak-ridge has no entry; other retail locations are fully available
      getAllMock.mockResolvedValueOnce([
        makeSnap(
          makeProductData('1g', {
            'oak-ridge': null,
            maryville: { availablePickup: true },
            seymour: { availablePickup: true },
          })
        ),
      ]);

      const items = JSON.stringify([{ productId: 'flower', variantId: '1g' }]);
      const res = await GET(makeRequest(items));
      expect(res.status).toBe(200);

      const body = (await res.json()) as {
        locations: Record<
          string,
          { available: boolean; unavailableItems: string[] }
        >;
      };
      expect(body.locations['oak-ridge'].available).toBe(false);
      expect(body.locations['oak-ridge'].unavailableItems).toContain('flower');
      expect(body.locations.maryville.available).toBe(true);
      expect(body.locations.seymour.available).toBe(true);
    });
  });

  describe('given a cart item with availablePickup: false at every location', () => {
    it('marks every retail location unavailable', async () => {
      getAllMock.mockResolvedValueOnce([
        makeSnap(
          makeProductData('1g', {
            'oak-ridge': { availablePickup: false },
            maryville: { availablePickup: false },
            seymour: { availablePickup: false },
          })
        ),
      ]);

      const items = JSON.stringify([{ productId: 'flower', variantId: '1g' }]);
      const res = await GET(makeRequest(items));
      expect(res.status).toBe(200);

      const body = (await res.json()) as {
        locations: Record<
          string,
          { available: boolean; unavailableItems: string[] }
        >;
      };
      for (const slug of ['oak-ridge', 'maryville', 'seymour']) {
        expect(body.locations[slug].available).toBe(false);
        expect(body.locations[slug].unavailableItems).toContain('flower');
      }
    });
  });

  describe('given a cart item with available stock fully reserved', () => {
    it('marks every retail location unavailable', async () => {
      getAllMock.mockResolvedValueOnce([
        makeSnap(
          makeProductData('1g', {
            'oak-ridge': { qty: 2, reserved: 2, availablePickup: true },
            maryville: { qty: 2, reserved: 2, availablePickup: true },
            seymour: { qty: 2, reserved: 2, availablePickup: true },
          })
        ),
      ]);

      const items = JSON.stringify([{ productId: 'flower', variantId: '1g' }]);
      const res = await GET(makeRequest(items));
      expect(res.status).toBe(200);

      const body = (await res.json()) as {
        locations: Record<
          string,
          { available: boolean; unavailableItems: string[] }
        >;
      };
      for (const slug of ['oak-ridge', 'maryville', 'seymour']) {
        expect(body.locations[slug].available).toBe(false);
      }
    });
  });

  describe('given all items are available at all retail locations', () => {
    it('returns available: true for each retail location', async () => {
      getAllMock.mockResolvedValueOnce([
        makeSnap(
          makeProductData('1g', {
            'oak-ridge': { availablePickup: true },
            maryville: { availablePickup: true },
            seymour: { availablePickup: true },
          })
        ),
      ]);

      const items = JSON.stringify([{ productId: 'flower', variantId: '1g' }]);
      const res = await GET(makeRequest(items));
      expect(res.status).toBe(200);

      const body = (await res.json()) as {
        locations: Record<
          string,
          { available: boolean; unavailableItems: string[] }
        >;
      };
      for (const slug of ['oak-ridge', 'maryville', 'seymour']) {
        expect(body.locations[slug].available).toBe(true);
        expect(body.locations[slug].unavailableItems).toHaveLength(0);
      }
    });
  });
});
