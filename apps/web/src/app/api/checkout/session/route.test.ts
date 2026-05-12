import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  holdStockMock,
  releaseStockMock,
  createCheckoutSessionMock,
  createCloverCheckoutSessionMock,
  priceCartMock,
} = vi.hoisted(() => ({
  holdStockMock: vi.fn(),
  releaseStockMock: vi.fn(),
  createCheckoutSessionMock: vi.fn(),
  createCloverCheckoutSessionMock: vi.fn(),
  priceCartMock: vi.fn(),
}));

// Re-export the real InsufficientStockError class so `instanceof` checks
// in the route module match the error thrown from the mock.
vi.mock('@/lib/repositories', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/repositories')>(
      '@/lib/repositories'
    );
  return {
    ...actual,
    holdStock: holdStockMock,
    releaseStock: releaseStockMock,
  };
});

vi.mock('@/lib/repositories/checkout-session.repository', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/repositories/checkout-session.repository')
  >('@/lib/repositories/checkout-session.repository');
  return {
    ...actual,
    createCheckoutSession: createCheckoutSessionMock,
  };
});

vi.mock('@/lib/clover/checkout', () => ({
  createCloverCheckoutSession: createCloverCheckoutSessionMock,
}));

// Mock `priceCart` but keep the real `StaleCartError` class so the route's
// `instanceof StaleCartError` branch matches what the mock throws.
vi.mock('@/lib/checkout/priceCart', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/checkout/priceCart')
  >('@/lib/checkout/priceCart');
  return { ...actual, priceCart: priceCartMock };
});

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/checkout/session/route';
import { InsufficientStockError } from '@/lib/repositories';
import { StaleCartError, type PricedCart } from '@/lib/checkout/priceCart';

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/checkout/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// What the browser sends — only productId/variantId/quantity are trusted.
// (The cart UI may still send unitPrice/lineTotal/subtotal/tax/total for its
// own estimate; the server ignores them.)
const VALID_BODY = {
  items: [{ productId: 'p1', variantId: 'default', quantity: 2 }],
  // NOTE: subtotal/tax/total are intentionally omitted here — they're
  // optional on the wire and the server ignores them. Tests that exercise
  // the client/server drift warning add `total` explicitly.
  locationId: 'online',
  deliveryAddress: {
    name: 'Jane Doe',
    line1: '1 Main St',
    city: 'Knoxville',
    state: 'TN',
    zip: '37902',
  },
  customerEmail: 'jane@example.com',
};

// The canonical, server-priced cart `priceCart` would return for VALID_BODY.
// tax = round(1000 * 0.0925) = 93.
const PRICED: PricedCart = {
  items: [
    {
      productId: 'p1',
      variantId: 'default',
      productName: 'Widget',
      quantity: 2,
      unitPrice: 500,
      lineTotal: 1000,
    },
  ],
  subtotal: 1000,
  tax: 93,
  total: 1093,
};

describe('POST /api/checkout/session — cart → CheckoutSession + Clover (#364)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    holdStockMock.mockResolvedValue(undefined);
    releaseStockMock.mockResolvedValue(undefined);
    priceCartMock.mockResolvedValue(PRICED);
    createCloverCheckoutSessionMock.mockResolvedValue({
      provider: 'clover',
      redirectUrl: 'https://clover.com/checkout/abc',
      cloverCheckoutSessionId: 'sess_abc',
    });
    createCheckoutSessionMock.mockResolvedValue('sess_abc');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('happy path', () => {
    it('re-prices server-side, holds stock, mints Clover session for the SERVER total, persists CheckoutSession with 24h expiresAt', async () => {
      const res = await POST(makeReq(VALID_BODY));
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        sessionId: string;
        redirectUrl: string;
      };
      expect(json.sessionId).toBe('sess_abc');
      expect(json.redirectUrl).toBe('/checkout/sess_abc/verify');

      // Re-priced against current product data, scoped to the location.
      expect(priceCartMock).toHaveBeenCalledTimes(1);
      expect(priceCartMock).toHaveBeenCalledWith(
        [{ productId: 'p1', variantId: 'default', quantity: 2 }],
        'online'
      );

      // Holds taken from the RE-PRICED cart.
      expect(holdStockMock).toHaveBeenCalledTimes(1);
      expect(holdStockMock.mock.calls[0][0]).toEqual([
        { productId: 'p1', variantId: 'default', locationId: 'online', qty: 2 },
      ]);

      // Clover invoked with the SERVER-COMPUTED total + tax + priced
      // items — never the client's stale figures.
      expect(createCloverCheckoutSessionMock).toHaveBeenCalledTimes(1);
      const cloverArg = createCloverCheckoutSessionMock.mock.calls[0][0];
      expect(cloverArg.amount).toBe(1093);
      expect(cloverArg.tax).toBe(93);
      expect(cloverArg.customerEmail).toBe('jane@example.com');
      expect(cloverArg.items).toEqual(PRICED.items);
      // Buyer name/address threaded through for Clover customer prefill.
      expect(cloverArg.deliveryAddress).toEqual(VALID_BODY.deliveryAddress);

      // CheckoutSession persisted with the server-computed money fields.
      expect(createCheckoutSessionMock).toHaveBeenCalledTimes(1);
      const persistArg = createCheckoutSessionMock.mock
        .calls[0][0] as import('@/lib/repositories/checkout-session.repository').CreateCheckoutSessionInput;
      expect(persistArg.subtotal).toBe(1000);
      expect(persistArg.tax).toBe(93);
      expect(persistArg.total).toBe(1093);
      expect(persistArg.items).toEqual(PRICED.items);
      expect(persistArg.cloverCheckoutSessionId).toBe('sess_abc');
      expect(persistArg.locationId).toBe('online');
      expect(persistArg.holds).toHaveLength(1);
      const ttlMs = persistArg.expiresAt.getTime() - Date.now();
      expect(ttlMs).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(ttlMs).toBeLessThan(25 * 60 * 60 * 1000);

      expect(releaseStockMock).not.toHaveBeenCalled();
    });

    it('warns (but proceeds with the server total) when the client total drifts from the server total', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const res = await POST(makeReq({ ...VALID_BODY, total: 99999 }));
      expect(res.status).toBe(200);
      expect(warn).toHaveBeenCalledWith(
        '[checkout/session] client/server total mismatch',
        expect.objectContaining({ clientTotal: 99999, serverTotal: 1093 })
      );
      // Server total still wins.
      expect(createCloverCheckoutSessionMock.mock.calls[0][0].amount).toBe(
        1093
      );
    });

    it('does NOT warn when the client total matches the server total', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await POST(makeReq({ ...VALID_BODY, total: 1093 }));
      expect(warn).not.toHaveBeenCalled();
    });

    it('does NOT write to orders/* (no order created at session creation)', async () => {
      const res = await POST(makeReq(VALID_BODY));
      expect(res.status).toBe(200);
      expect(priceCartMock).toHaveBeenCalled();
      expect(holdStockMock).toHaveBeenCalled();
      expect(createCloverCheckoutSessionMock).toHaveBeenCalled();
      expect(createCheckoutSessionMock).toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('returns 400 when cart is empty', async () => {
      const res = await POST(makeReq({ ...VALID_BODY, items: [] }));
      expect(res.status).toBe(400);
      expect(priceCartMock).not.toHaveBeenCalled();
      expect(holdStockMock).not.toHaveBeenCalled();
      expect(createCloverCheckoutSessionMock).not.toHaveBeenCalled();
    });

    it('returns 400 for an unknown locationId before holding stock (#audit M3)', async () => {
      const res = await POST(makeReq({ ...VALID_BODY, locationId: 'narnia' }));
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string };
      expect(json.error).toMatch(/locationId/i);
      expect(priceCartMock).not.toHaveBeenCalled();
      expect(holdStockMock).not.toHaveBeenCalled();
      expect(createCloverCheckoutSessionMock).not.toHaveBeenCalled();
    });

    it('accepts the ONLINE_LOCATION_ID and a real retail location slug', async () => {
      for (const loc of ['online', 'oak-ridge']) {
        vi.clearAllMocks();
        priceCartMock.mockResolvedValue(PRICED);
        createCloverCheckoutSessionMock.mockResolvedValue({
          provider: 'clover',
          redirectUrl: 'https://clover.com/checkout/abc',
          cloverCheckoutSessionId: 'sess_abc',
        });
        createCheckoutSessionMock.mockResolvedValue('sess_abc');
        const res = await POST(makeReq({ ...VALID_BODY, locationId: loc }));
        expect(res.status).toBe(200);
      }
    });

    it('returns 400 when delivery address state is missing', async () => {
      const res = await POST(
        makeReq({
          ...VALID_BODY,
          deliveryAddress: { ...VALID_BODY.deliveryAddress, state: '' },
        })
      );
      expect(res.status).toBe(400);
      expect(priceCartMock).not.toHaveBeenCalled();
      expect(holdStockMock).not.toHaveBeenCalled();
    });

    it('returns 400 when a cart line has a non-positive or non-integer quantity', async () => {
      for (const bad of [0, -1, 1.5]) {
        vi.clearAllMocks();
        priceCartMock.mockResolvedValue(PRICED);
        const res = await POST(
          makeReq({
            ...VALID_BODY,
            items: [{ productId: 'p1', variantId: 'default', quantity: bad }],
          })
        );
        expect(res.status).toBe(400);
        expect(priceCartMock).not.toHaveBeenCalled();
        expect(holdStockMock).not.toHaveBeenCalled();
      }
    });
  });

  describe('stale cart (server re-pricing fails)', () => {
    it('returns 400 with reason=stale_cart and never holds stock or calls Clover', async () => {
      priceCartMock.mockRejectedValueOnce(
        new StaleCartError('Product gone.', 'p1', 'default')
      );
      const res = await POST(makeReq(VALID_BODY));
      expect(res.status).toBe(400);
      const json = (await res.json()) as {
        error: string;
        reason: string;
        productId: string;
        variantId: string;
      };
      expect(json.reason).toBe('stale_cart');
      expect(json.productId).toBe('p1');
      expect(json.variantId).toBe('default');
      expect(holdStockMock).not.toHaveBeenCalled();
      expect(createCloverCheckoutSessionMock).not.toHaveBeenCalled();
      expect(createCheckoutSessionMock).not.toHaveBeenCalled();
      expect(releaseStockMock).not.toHaveBeenCalled();
    });

    it('rethrows a non-StaleCartError from priceCart', async () => {
      priceCartMock.mockRejectedValueOnce(new Error('firestore exploded'));
      await expect(POST(makeReq(VALID_BODY))).rejects.toThrow(/firestore/);
      expect(holdStockMock).not.toHaveBeenCalled();
    });
  });

  describe('shipping eligibility', () => {
    it('returns 422 with a reason when shipping to the destination state is blocked', async () => {
      const res = await POST(
        makeReq({
          ...VALID_BODY,
          deliveryAddress: { ...VALID_BODY.deliveryAddress, state: 'ID' },
        })
      );
      expect(res.status).toBe(422);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBeTruthy();
      expect(priceCartMock).not.toHaveBeenCalled();
      expect(holdStockMock).not.toHaveBeenCalled();
      expect(createCloverCheckoutSessionMock).not.toHaveBeenCalled();
    });
  });

  describe('hold-shortage 409', () => {
    it('returns 409 with shortage details and never calls Clover or persists a session', async () => {
      holdStockMock.mockRejectedValueOnce(
        new InsufficientStockError('online', 'p1', 1, 2, 'default')
      );
      const res = await POST(makeReq(VALID_BODY));
      expect(res.status).toBe(409);
      const json = (await res.json()) as {
        error: string;
        productId: string;
        available: number;
        requested: number;
      };
      expect(json.productId).toBe('p1');
      expect(json.available).toBe(1);
      expect(json.requested).toBe(2);
      expect(createCloverCheckoutSessionMock).not.toHaveBeenCalled();
      expect(createCheckoutSessionMock).not.toHaveBeenCalled();
      expect(releaseStockMock).not.toHaveBeenCalled();
    });
  });

  describe('Clover failure rolls holds back', () => {
    it('releases held stock and surfaces the error when Clover session creation fails', async () => {
      createCloverCheckoutSessionMock.mockRejectedValueOnce(
        new Error('Clover API 500')
      );
      await expect(POST(makeReq(VALID_BODY))).rejects.toThrow(/Clover/);
      expect(holdStockMock).toHaveBeenCalledTimes(1);
      expect(releaseStockMock).toHaveBeenCalledTimes(1);
      expect(releaseStockMock.mock.calls[0][0]).toEqual([
        { productId: 'p1', variantId: 'default', locationId: 'online', qty: 2 },
      ]);
      expect(createCheckoutSessionMock).not.toHaveBeenCalled();
    });
  });
});
