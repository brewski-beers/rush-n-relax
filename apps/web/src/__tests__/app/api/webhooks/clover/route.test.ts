import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { transitionStatusMock, InvalidTransitionErrorMock } = vi.hoisted(() => {
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
  return {
    transitionStatusMock: vi.fn(),
    InvalidTransitionErrorMock,
  };
});

vi.mock('@/lib/repositories/order.repository', () => ({
  transitionStatus: transitionStatusMock,
  InvalidTransitionError: InvalidTransitionErrorMock,
}));

import { POST } from '@/app/api/webhooks/clover/route';

// ── Helpers ────────────────────────────────────────────────────────────────

const SECRET = 'test-clover-secret';

function sign(body: string): string {
  return crypto.createHmac('sha256', SECRET).update(body).digest('hex');
}

function makeReq(
  body: unknown,
  opts: { signature?: string | null; bodyOverride?: string } = {}
): NextRequest {
  const raw = opts.bodyOverride ?? JSON.stringify(body);
  const signature = opts.signature === undefined ? sign(raw) : opts.signature;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (signature !== null) headers['x-clover-signature'] = signature;
  return new NextRequest('http://localhost/api/webhooks/clover', {
    method: 'POST',
    headers,
    body: raw,
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/webhooks/clover', () => {
  const ORIGINAL_SECRET = process.env.CLOVER_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLOVER_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.CLOVER_WEBHOOK_SECRET;
    } else {
      process.env.CLOVER_WEBHOOK_SECRET = ORIGINAL_SECRET;
    }
  });

  // ── Signature verification ───────────────────────────────────────────────

  describe('GIVEN signature verification', () => {
    it('WHEN signature header matches HMAC-SHA256 of raw body THEN handler proceeds and returns 200', async () => {
      transitionStatusMock.mockResolvedValue({ id: 'order-1' });

      const res = await POST(
        makeReq({
          type: 'payment.succeeded',
          data: { orderId: 'order-1', paymentId: 'pay_abc' },
        })
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body).toEqual({ received: true, handled: true });
      expect(transitionStatusMock).toHaveBeenCalledOnce();
    });

    it('WHEN signature header is wrong THEN returns 401 and never transitions', async () => {
      const res = await POST(
        makeReq(
          { type: 'payment.succeeded', data: { orderId: 'order-1' } },
          { signature: 'deadbeef' }
        )
      );

      expect(res.status).toBe(401);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe('Invalid signature');
      expect(transitionStatusMock).not.toHaveBeenCalled();
    });

    it('WHEN signature header is missing entirely THEN returns 401', async () => {
      const res = await POST(
        makeReq(
          { type: 'payment.succeeded', data: { orderId: 'order-1' } },
          { signature: null }
        )
      );

      expect(res.status).toBe(401);
      expect(transitionStatusMock).not.toHaveBeenCalled();
    });

    it('WHEN CLOVER_WEBHOOK_SECRET is unset THEN every request is rejected with 401', async () => {
      delete process.env.CLOVER_WEBHOOK_SECRET;

      const res = await POST(
        makeReq({ type: 'payment.succeeded', data: { orderId: 'order-1' } })
      );

      expect(res.status).toBe(401);
      expect(transitionStatusMock).not.toHaveBeenCalled();
    });

    it('WHEN signature header is malformed (non-hex) THEN returns 401 without throwing', async () => {
      const res = await POST(
        makeReq(
          { type: 'payment.succeeded', data: { orderId: 'order-1' } },
          { signature: 'zzz-not-hex' }
        )
      );

      expect(res.status).toBe(401);
    });
  });

  // ── Event → status mapping ───────────────────────────────────────────────

  describe('GIVEN supported event types', () => {
    it.each([
      ['payment.succeeded', 'paid'],
      ['payment.failed', 'failed'],
      ['payment.refunded', 'refunded'],
      ['payment.voided', 'cancelled'],
    ] as const)(
      'WHEN event=%s THEN transitions order to %s',
      async (eventType, expectedStatus) => {
        transitionStatusMock.mockResolvedValue({ id: 'order-1' });

        const res = await POST(
          makeReq({
            type: eventType,
            data: { orderId: 'order-1', paymentId: 'pay_abc' },
          })
        );

        expect(res.status).toBe(200);
        expect(transitionStatusMock).toHaveBeenCalledWith(
          'order-1',
          expectedStatus,
          'webhook:clover',
          expect.objectContaining({
            eventType,
            cloverPaymentId: 'pay_abc',
          })
        );
      }
    );

    it('WHEN paymentId is absent THEN transition still runs but cloverPaymentId is omitted from meta', async () => {
      transitionStatusMock.mockResolvedValue({ id: 'order-1' });

      await POST(
        makeReq({ type: 'payment.succeeded', data: { orderId: 'order-1' } })
      );

      const meta = transitionStatusMock.mock.calls[0][3] as Record<
        string,
        unknown
      >;
      expect(meta.eventType).toBe('payment.succeeded');
      expect(meta.cloverPaymentId).toBeUndefined();
    });
  });

  // ── Idempotency on paymentId ─────────────────────────────────────────────

  describe('GIVEN webhook re-delivery for the same paymentId (idempotency)', () => {
    it('WHEN order already in `paid` and payment.succeeded re-arrives THEN returns 200 handled=false (no double-charge effect)', async () => {
      transitionStatusMock.mockRejectedValue(
        new InvalidTransitionErrorMock('paid', 'paid')
      );

      const res = await POST(
        makeReq({
          type: 'payment.succeeded',
          data: { orderId: 'order-1', paymentId: 'pay_dup' },
        })
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body).toEqual({ received: true, handled: false });
    });

    it('WHEN payment.refunded re-arrives for already-refunded order THEN returns 200 handled=false', async () => {
      transitionStatusMock.mockRejectedValue(
        new InvalidTransitionErrorMock('refunded', 'refunded')
      );

      const res = await POST(
        makeReq({
          type: 'payment.refunded',
          data: { orderId: 'order-1', paymentId: 'pay_dup' },
        })
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.handled).toBe(false);
    });

    it('WHEN underlying repo throws a non-InvalidTransitionError THEN it bubbles up', async () => {
      transitionStatusMock.mockRejectedValue(
        new Error('firestore unreachable')
      );

      await expect(
        POST(
          makeReq({
            type: 'payment.succeeded',
            data: { orderId: 'order-1', paymentId: 'pay_x' },
          })
        )
      ).rejects.toThrow(/firestore unreachable/);
    });
  });

  // ── Bad-input handling ───────────────────────────────────────────────────

  describe('GIVEN malformed or unsupported payloads', () => {
    it('WHEN body is not valid JSON THEN returns 400 and does not transition', async () => {
      const res = await POST(makeReq({}, { bodyOverride: 'not-json' }));

      expect(res.status).toBe(400);
      expect(transitionStatusMock).not.toHaveBeenCalled();
    });

    it('WHEN event type is unknown THEN returns 200 handled=false (Clover stops retrying)', async () => {
      const res = await POST(
        makeReq({
          type: 'invoice.created',
          data: { orderId: 'order-1' },
        })
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body).toEqual({ received: true, handled: false });
      expect(transitionStatusMock).not.toHaveBeenCalled();
    });

    it('WHEN orderId is missing THEN returns 400 with explanatory error', async () => {
      const res = await POST(
        makeReq({ type: 'payment.succeeded', data: { paymentId: 'pay_a' } })
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe('Missing orderId');
      expect(transitionStatusMock).not.toHaveBeenCalled();
    });
  });
});
