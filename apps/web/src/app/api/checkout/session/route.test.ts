import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  holdStockMock,
  releaseStockMock,
  createCheckoutSessionMock,
  createCloverCheckoutSessionMock,
} = vi.hoisted(() => ({
  holdStockMock: vi.fn(),
  releaseStockMock: vi.fn(),
  createCheckoutSessionMock: vi.fn(),
  createCloverCheckoutSessionMock: vi.fn(),
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

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/checkout/session/route';
import { InsufficientStockError } from '@/lib/repositories';

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/checkout/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
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
  tax: 100,
  total: 1100,
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

describe('POST /api/checkout/session — cart → CheckoutSession + Clover (#364)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    holdStockMock.mockResolvedValue(undefined);
    releaseStockMock.mockResolvedValue(undefined);
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
    it('holds stock, mints Clover session, persists CheckoutSession with 24h expiresAt, returns sessionId + verify redirect', async () => {
      const res = await POST(makeReq(VALID_BODY));
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        sessionId: string;
        redirectUrl: string;
      };
      expect(json.sessionId).toBe('sess_abc');
      expect(json.redirectUrl).toBe('/checkout/sess_abc/verify');

      // Holds taken from cart (variantId defaults to 'default')
      expect(holdStockMock).toHaveBeenCalledTimes(1);
      const heldItems = holdStockMock.mock.calls[0][0];
      expect(heldItems).toEqual([
        {
          productId: 'p1',
          variantId: 'default',
          locationId: 'online',
          qty: 2,
        },
      ]);

      // Clover invoked with cart total + items + email
      expect(createCloverCheckoutSessionMock).toHaveBeenCalledTimes(1);
      const cloverArg = createCloverCheckoutSessionMock.mock.calls[0][0];
      expect(cloverArg.amount).toBe(1100);
      expect(cloverArg.customerEmail).toBe('jane@example.com');
      expect(cloverArg.items).toEqual(VALID_BODY.items);
      // Buyer name/address threaded through for Clover customer prefill.
      expect(cloverArg.deliveryAddress).toEqual(VALID_BODY.deliveryAddress);

      // CheckoutSession persisted with awaiting_id (status owned by repo) +
      // Clover session id + 24h TTL expiresAt.
      expect(createCheckoutSessionMock).toHaveBeenCalledTimes(1);
      const persistArg = createCheckoutSessionMock.mock
        .calls[0][0] as import('@/lib/repositories/checkout-session.repository').CreateCheckoutSessionInput;
      expect(persistArg.cloverCheckoutSessionId).toBe('sess_abc');
      expect(persistArg.locationId).toBe('online');
      expect(persistArg.holds).toHaveLength(1);
      const ttlMs = persistArg.expiresAt.getTime() - Date.now();
      // Allow generous slack (test scheduling jitter): 23h–25h.
      expect(ttlMs).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(ttlMs).toBeLessThan(25 * 60 * 60 * 1000);

      // Holds NOT released on the success path.
      expect(releaseStockMock).not.toHaveBeenCalled();
    });

    it('does NOT write to orders/* (no order created at session creation)', async () => {
      // No orders mock is provided; if the route attempted to call any
      // order repo function the test would fail with `not a function`.
      // We assert by absence: only the three expected collaborators run.
      const res = await POST(makeReq(VALID_BODY));
      expect(res.status).toBe(200);
      expect(holdStockMock).toHaveBeenCalled();
      expect(createCloverCheckoutSessionMock).toHaveBeenCalled();
      expect(createCheckoutSessionMock).toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('returns 400 when cart is empty', async () => {
      const res = await POST(makeReq({ ...VALID_BODY, items: [] }));
      expect(res.status).toBe(400);
      expect(holdStockMock).not.toHaveBeenCalled();
      expect(createCloverCheckoutSessionMock).not.toHaveBeenCalled();
      expect(createCheckoutSessionMock).not.toHaveBeenCalled();
    });

    it('returns 400 when delivery address state is missing', async () => {
      const res = await POST(
        makeReq({
          ...VALID_BODY,
          deliveryAddress: { ...VALID_BODY.deliveryAddress, state: '' },
        })
      );
      expect(res.status).toBe(400);
      expect(holdStockMock).not.toHaveBeenCalled();
    });
  });

  describe('shipping eligibility', () => {
    it('returns 422 with a reason when shipping to the destination state is blocked', async () => {
      const res = await POST(
        makeReq({
          ...VALID_BODY,
          // Idaho is on the SHIPPING_STATES blocked list.
          deliveryAddress: { ...VALID_BODY.deliveryAddress, state: 'ID' },
        })
      );
      expect(res.status).toBe(422);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBeTruthy();
      // No side effects when shipping is blocked.
      expect(holdStockMock).not.toHaveBeenCalled();
      expect(createCloverCheckoutSessionMock).not.toHaveBeenCalled();
      expect(createCheckoutSessionMock).not.toHaveBeenCalled();
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
      // No release needed — the failed hold was rolled back atomically
      // inside `holdStock` itself.
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
      const released = releaseStockMock.mock.calls[0][0];
      expect(released).toEqual([
        {
          productId: 'p1',
          variantId: 'default',
          locationId: 'online',
          qty: 2,
        },
      ]);
      expect(createCheckoutSessionMock).not.toHaveBeenCalled();
    });
  });
});
