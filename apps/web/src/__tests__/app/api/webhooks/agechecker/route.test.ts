import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  transitionStatusMock,
  getOrderMock,
  decrementVariantStockMock,
  verifySigMock,
  InvalidTransitionErrorMock,
  InsufficientStockErrorMock,
} = vi.hoisted(() => {
  class InvalidTransitionErrorMock extends Error {
    readonly from: string | null;
    readonly to: string;
    constructor(from: string | null, to: string) {
      super(`invalid: ${from ?? 'null'} -> ${to}`);
      this.name = 'InvalidTransitionError';
      this.from = from;
      this.to = to;
    }
  }
  class InsufficientStockErrorMock extends Error {
    readonly productId: string;
    readonly variantId: string;
    readonly locationId: string;
    readonly available: number;
    readonly requested: number;
    constructor(
      locationId: string,
      productId: string,
      available: number,
      requested: number,
      variantId: string = 'default'
    ) {
      super('insufficient');
      this.name = 'InsufficientStockError';
      this.productId = productId;
      this.variantId = variantId;
      this.locationId = locationId;
      this.available = available;
      this.requested = requested;
    }
  }
  return {
    transitionStatusMock: vi.fn(),
    getOrderMock: vi.fn(),
    decrementVariantStockMock: vi.fn(),
    verifySigMock: vi.fn(() => true),
    InvalidTransitionErrorMock,
    InsufficientStockErrorMock,
  };
});

vi.mock('@/lib/repositories', () => ({
  transitionStatus: transitionStatusMock,
  getOrder: getOrderMock,
  decrementVariantStock: decrementVariantStockMock,
  InvalidTransitionError: InvalidTransitionErrorMock,
  InsufficientStockError: InsufficientStockErrorMock,
}));

vi.mock('@/lib/agechecker', () => ({
  verifyAgeCheckerSignature: verifySigMock,
}));

import { POST } from '@/app/api/webhooks/agechecker/route';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/webhooks/agechecker', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-agechecker-signature': 'test',
    },
    body: JSON.stringify(body),
  });
}

const SAMPLE_ORDER = {
  id: 'order-1',
  locationId: 'oak-ridge',
  items: [
    { productId: 'prod-a', variantId: 'default', quantity: 2 },
    { productId: 'prod-b', variantId: 'large', quantity: 1 },
  ],
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/webhooks/agechecker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifySigMock.mockReturnValue(true);
  });

  describe('given outcome=pass with sufficient stock', () => {
    it('transitions to id_verified and decrements inventory atomically', async () => {
      transitionStatusMock.mockResolvedValue({ id: 'order-1' });
      getOrderMock.mockResolvedValue(SAMPLE_ORDER);
      decrementVariantStockMock.mockResolvedValue(undefined);

      const res = await POST(
        makeReq({ verificationId: 'v1', status: 'pass', orderId: 'order-1' })
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body).toEqual({ received: true, handled: true });
      expect(transitionStatusMock).toHaveBeenCalledWith(
        'order-1',
        'id_verified',
        'webhook:agechecker',
        { verificationId: 'v1' }
      );
      expect(decrementVariantStockMock).toHaveBeenCalledWith(
        [
          {
            slug: 'prod-a',
            variantId: 'default',
            locationId: 'oak-ridge',
            qty: 2,
          },
          {
            slug: 'prod-b',
            variantId: 'large',
            locationId: 'oak-ridge',
            qty: 1,
          },
        ],
        { source: 'order', actor: 'webhook:agechecker' }
      );
    });
  });

  describe('given outcome=deny', () => {
    it('transitions to id_rejected and skips inventory', async () => {
      transitionStatusMock.mockResolvedValue({ id: 'order-1' });

      const res = await POST(
        makeReq({ verificationId: 'v2', status: 'deny', orderId: 'order-1' })
      );

      expect(res.status).toBe(200);
      expect(transitionStatusMock).toHaveBeenCalledWith(
        'order-1',
        'id_rejected',
        'webhook:agechecker',
        { verificationId: 'v2', reason: 'deny' }
      );
      expect(decrementVariantStockMock).not.toHaveBeenCalled();
    });
  });

  describe('given outcome=underage', () => {
    it('transitions to id_rejected with reason=underage', async () => {
      transitionStatusMock.mockResolvedValue({ id: 'order-1' });

      const res = await POST(
        makeReq({
          verificationId: 'v3',
          status: 'underage',
          orderId: 'order-1',
        })
      );

      expect(res.status).toBe(200);
      expect(transitionStatusMock).toHaveBeenCalledWith(
        'order-1',
        'id_rejected',
        'webhook:agechecker',
        { verificationId: 'v3', reason: 'underage' }
      );
    });
  });

  describe('given outcome=manual_review', () => {
    it('does not transition and acks', async () => {
      const res = await POST(
        makeReq({
          verificationId: 'v4',
          status: 'manual_review',
          orderId: 'order-1',
        })
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body).toEqual({ received: true, handled: false });
      expect(transitionStatusMock).not.toHaveBeenCalled();
      expect(decrementVariantStockMock).not.toHaveBeenCalled();
    });
  });

  describe('given outcome=pending', () => {
    it('does not transition and acks', async () => {
      const res = await POST(
        makeReq({
          verificationId: 'v5',
          status: 'pending',
          orderId: 'order-1',
        })
      );

      expect(res.status).toBe(200);
      expect(transitionStatusMock).not.toHaveBeenCalled();
    });
  });

  describe('given a duplicate webhook (already past id_verified)', () => {
    it('catches InvalidTransitionError and returns 200 already_processed', async () => {
      transitionStatusMock.mockRejectedValue(
        new InvalidTransitionErrorMock('id_verified', 'id_verified')
      );

      const res = await POST(
        makeReq({ verificationId: 'v1', status: 'pass', orderId: 'order-1' })
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body).toEqual({
        received: true,
        handled: false,
        reason: 'already_processed',
      });
      expect(decrementVariantStockMock).not.toHaveBeenCalled();
    });
  });

  describe('given oversell during inventory decrement', () => {
    it('returns 409 and does not partially commit (transaction rolled back)', async () => {
      transitionStatusMock.mockResolvedValue({ id: 'order-1' });
      getOrderMock.mockResolvedValue(SAMPLE_ORDER);
      decrementVariantStockMock.mockRejectedValue(
        new InsufficientStockErrorMock('oak-ridge', 'prod-a', 1, 2)
      );

      const res = await POST(
        makeReq({ verificationId: 'v1', status: 'pass', orderId: 'order-1' })
      );

      expect(res.status).toBe(409);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe('Insufficient stock');
      expect(body.productId).toBe('prod-a');
      expect(body.available).toBe(1);
      expect(body.requested).toBe(2);
    });
  });

  describe('given an invalid signature', () => {
    it('returns 401 and does no work', async () => {
      verifySigMock.mockReturnValue(false);

      const res = await POST(
        makeReq({ verificationId: 'v1', status: 'pass', orderId: 'order-1' })
      );

      expect(res.status).toBe(401);
      expect(transitionStatusMock).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // BDD: idempotency on verificationId + signature edge cases (#284)
  // ────────────────────────────────────────────────────────────────────────

  describe('GIVEN a duplicate webhook for the same verificationId', () => {
    it('WHEN re-delivered for an order already moved past pending_id_verification THEN returns already_processed without re-decrementing inventory', async () => {
      transitionStatusMock.mockRejectedValue(
        new InvalidTransitionErrorMock('id_verified', 'id_verified')
      );

      const first = await POST(
        makeReq({
          verificationId: 'dup-v1',
          status: 'pass',
          orderId: 'order-1',
        })
      );
      expect(first.status).toBe(200);
      const firstBody = (await first.json()) as Record<string, unknown>;
      expect(firstBody.reason).toBe('already_processed');
      expect(decrementVariantStockMock).not.toHaveBeenCalled();
    });

    it('WHEN deny is re-delivered after id_rejected was already applied THEN returns already_processed', async () => {
      transitionStatusMock.mockRejectedValue(
        new InvalidTransitionErrorMock('id_rejected', 'id_rejected')
      );

      const res = await POST(
        makeReq({
          verificationId: 'dup-v2',
          status: 'deny',
          orderId: 'order-1',
        })
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body).toEqual({
        received: true,
        handled: false,
        reason: 'already_processed',
      });
    });
  });

  describe('GIVEN oversell in the inventory transaction', () => {
    it('WHEN decrementInventoryItems throws InsufficientStockError THEN status remains advanced (id_verified) and the inventory tx is rolled back', async () => {
      transitionStatusMock.mockResolvedValue({ id: 'order-1' });
      getOrderMock.mockResolvedValue(SAMPLE_ORDER);
      decrementVariantStockMock.mockRejectedValue(
        new InsufficientStockErrorMock('oak-ridge', 'prod-b', 0, 1)
      );

      const res = await POST(
        makeReq({ verificationId: 'os1', status: 'pass', orderId: 'order-1' })
      );

      expect(res.status).toBe(409);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe('Insufficient stock');
      // transitionStatus to id_verified DID succeed (called once); the
      // rollback is internal to decrementInventoryItems' transaction.
      expect(transitionStatusMock).toHaveBeenCalledOnce();
      expect(decrementVariantStockMock).toHaveBeenCalledOnce();
    });
  });

  describe('GIVEN a webhook with no x-agechecker-signature header', () => {
    it('WHEN verifier rejects the missing signature THEN returns 401 with no side effects', async () => {
      verifySigMock.mockReturnValue(false);

      const req = new Request('http://localhost/api/webhooks/agechecker', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          verificationId: 'v1',
          status: 'pass',
          orderId: 'order-1',
        }),
      });
      const res = await POST(req);

      expect(res.status).toBe(401);
      // the verifier was called with header=null
      const callArgs = verifySigMock.mock.calls[0] as unknown as [
        string,
        string | null,
      ];
      expect(callArgs[1]).toBeNull();
      expect(transitionStatusMock).not.toHaveBeenCalled();
      expect(decrementVariantStockMock).not.toHaveBeenCalled();
    });
  });

  describe('GIVEN an invalid JSON body with a valid signature', () => {
    it('WHEN parsing fails THEN returns 400 and never touches Firestore', async () => {
      const req = new Request('http://localhost/api/webhooks/agechecker', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-agechecker-signature': 'test',
        },
        body: 'not-json',
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
      expect(transitionStatusMock).not.toHaveBeenCalled();
    });
  });

  describe('GIVEN outcome=pass with no orderId in the payload', () => {
    it('WHEN no order is bound THEN acks with handled=false and does not transition', async () => {
      const res = await POST(
        makeReq({ verificationId: 'v-no-order', status: 'pass' })
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body).toEqual({ received: true, handled: false });
      expect(transitionStatusMock).not.toHaveBeenCalled();
    });
  });

  describe('GIVEN an unknown status string', () => {
    it('WHEN handler does not recognize the outcome THEN returns 200 handled=false (no infinite retry)', async () => {
      const res = await POST(
        makeReq({
          verificationId: 'vX',
          status: 'banana',
          orderId: 'order-1',
        })
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body).toEqual({ received: true, handled: false });
      expect(transitionStatusMock).not.toHaveBeenCalled();
    });
  });

  describe('GIVEN oversell on one specific variant of a multi-variant product', () => {
    it('WHEN the variant transaction throws InsufficientStockError THEN the whole tx rolls back; other variants of the same product are not partially decremented (single-tx invariant)', async () => {
      transitionStatusMock.mockResolvedValue({ id: 'order-1' });
      // Same product, two variants on one order — exercises the
      // multi-line composition path inside decrementVariantStock.
      getOrderMock.mockResolvedValue({
        id: 'order-1',
        locationId: 'oak-ridge',
        items: [
          { productId: 'prod-a', variantId: 'small', quantity: 1 },
          { productId: 'prod-a', variantId: 'large', quantity: 5 },
        ],
      });
      // The helper validates ALL items inside one tx; throwing here
      // simulates the 'large' variant being short. The contract is that
      // no partial writes survive — verified at the repo layer's tx test;
      // here we assert the webhook surfaces 409 with the specific variant.
      decrementVariantStockMock.mockRejectedValue(
        new InsufficientStockErrorMock('oak-ridge', 'prod-a', 0, 5, 'large')
      );

      const res = await POST(
        makeReq({ verificationId: 'v-mv', status: 'pass', orderId: 'order-1' })
      );

      expect(res.status).toBe(409);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe('Insufficient stock');
      expect(body.productId).toBe('prod-a');
      // The whole array of items was passed to the helper — no per-item
      // pre-filtering by the webhook. The repository owns the atomic guarantee.
      expect(decrementVariantStockMock).toHaveBeenCalledOnce();
      const callArgs = decrementVariantStockMock.mock.calls[0] as unknown as [
        Array<{ slug: string; variantId: string; locationId: string; qty: number }>,
        { source?: string; actor?: string },
      ];
      expect(callArgs[0]).toHaveLength(2);
      expect(callArgs[0][0]).toEqual({
        slug: 'prod-a',
        variantId: 'small',
        locationId: 'oak-ridge',
        qty: 1,
      });
      expect(callArgs[0][1]).toEqual({
        slug: 'prod-a',
        variantId: 'large',
        locationId: 'oak-ridge',
        qty: 5,
      });
    });
  });
});
