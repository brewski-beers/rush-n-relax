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

// Stub LOCATION_SLUGS to only retail slugs so tests are deterministic
vi.mock('@/lib/fixtures/storefront', () => ({
  LOCATION_SLUGS: ['oak-ridge', 'maryville', 'seymour', 'hub', 'online'],
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

// Raw Firestore document data — mirrors what snap.data() returns
function makeInventoryData(
  overrides: Partial<{
    availablePickup: boolean;
    quantity: number;
    variantPricing: Record<string, { price: number; inStock?: boolean }>;
  }> = {}
) {
  return { quantity: 10, availablePickup: true, ...overrides };
}

// Snapshot-like object matching the shape docToPartialInventory reads
function makeSnap(data: ReturnType<typeof makeInventoryData> | null) {
  if (data === null) return { exists: false, data: () => ({}) };
  return { exists: true, data: () => data as Record<string, unknown> };
}

// Extracts locationSlug from a collection path like "inventory/oak-ridge/items"
function locationFromRef(ref: { _path: string }): string {
  return ref._path.split('/')[1];
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

  describe('given a cart item whose inventory entry is missing at a location', () => {
    it('marks that location unavailable with the productId in unavailableItems', async () => {
      // oak-ridge has no inventory doc; other locations are fully available
      getAllMock.mockImplementation(
        (...refs: Array<{ _path: string; id: string }>) => {
          const slug = locationFromRef(refs[0]);
          return Promise.resolve(
            refs.map(() =>
              makeSnap(
                slug === 'oak-ridge'
                  ? null
                  : makeInventoryData({
                      availablePickup: true,
                      variantPricing: { '1g': { price: 1000, inStock: true } },
                    })
              )
            )
          );
        }
      );

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
    });
  });

  describe('given a cart item with availablePickup: false at a location', () => {
    it('marks that location unavailable', async () => {
      getAllMock.mockImplementation(
        (...refs: Array<{ _path: string; id: string }>) =>
          Promise.resolve(
            refs.map(() =>
              makeSnap(
                makeInventoryData({
                  availablePickup: false,
                  variantPricing: { '1g': { price: 1000, inStock: true } },
                })
              )
            )
          )
      );

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

  describe('given a cart item with variantPricing[variantId].inStock === false', () => {
    it('marks the location unavailable for that item', async () => {
      getAllMock.mockImplementation(
        (...refs: Array<{ _path: string; id: string }>) =>
          Promise.resolve(
            refs.map(() =>
              makeSnap(
                makeInventoryData({
                  availablePickup: true,
                  variantPricing: { '1g': { price: 1000, inStock: false } },
                })
              )
            )
          )
      );

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
      getAllMock.mockImplementation(
        (...refs: Array<{ _path: string; id: string }>) =>
          Promise.resolve(
            refs.map(() =>
              makeSnap(
                makeInventoryData({
                  availablePickup: true,
                  variantPricing: { '1g': { price: 1000, inStock: true } },
                })
              )
            )
          )
      );

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
