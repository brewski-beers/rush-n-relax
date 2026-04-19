import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { getInventoryItemMock } = vi.hoisted(() => ({
  getInventoryItemMock: vi.fn(),
}));

vi.mock('@/lib/repositories/inventory.repository', () => ({
  getInventoryItem: getInventoryItemMock,
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

function makeInventoryItem(
  overrides: Partial<{
    availablePickup: boolean;
    variantPricing: Record<string, { price: number; inStock?: boolean }>;
  }> = {}
) {
  return {
    productId: 'flower',
    locationId: 'oak-ridge',
    inStock: true,
    availableOnline: true,
    availablePickup: true,
    featured: false,
    quantity: 10,
    ...overrides,
  };
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
      // oak-ridge returns null (no inventory entry); others return available item
      getInventoryItemMock.mockImplementation(
        async (locationSlug: string, _productId: string) => {
          if (locationSlug === 'oak-ridge') return null;
          return makeInventoryItem({
            availablePickup: true,
            variantPricing: { '1g': { price: 1000, inStock: true } },
          });
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
      getInventoryItemMock.mockResolvedValue(
        makeInventoryItem({
          availablePickup: false,
          variantPricing: { '1g': { price: 1000, inStock: true } },
        })
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
      // All retail locations should be unavailable
      for (const slug of ['oak-ridge', 'maryville', 'seymour']) {
        expect(body.locations[slug].available).toBe(false);
        expect(body.locations[slug].unavailableItems).toContain('flower');
      }
    });
  });

  describe('given a cart item with variantPricing[variantId].inStock === false', () => {
    it('marks the location unavailable for that item', async () => {
      getInventoryItemMock.mockResolvedValue(
        makeInventoryItem({
          availablePickup: true,
          variantPricing: { '1g': { price: 1000, inStock: false } },
        })
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
      getInventoryItemMock.mockResolvedValue(
        makeInventoryItem({
          availablePickup: true,
          variantPricing: { '1g': { price: 1000, inStock: true } },
        })
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
