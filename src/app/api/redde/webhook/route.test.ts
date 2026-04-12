/**
 * Unit tests for Redde webhook handler.
 * Mocks updateOrderStatus — never hits Firestore.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'crypto';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUpdateOrderStatus = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/repositories/order.repository', () => ({
  updateOrderStatus: mockUpdateOrderStatus,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const WEBHOOK_SECRET = 'test-webhook-secret';

function sign(body: string): string {
  const digest = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
  return `sha256=${digest}`;
}

function makeRequest(body: unknown, sig?: string | null): Request {
  const bodyStr = JSON.stringify(body);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (sig !== null) {
    headers['x-redde-signature'] = sig ?? sign(bodyStr);
  }
  return new Request('http://localhost/api/redde/webhook', {
    method: 'POST',
    headers,
    body: bodyStr,
  });
}

function paidEvent(orderId = 'ord-123', txnId = 'rde_txn_abc') {
  return { event: 'payment.paid', txnId, orderId, amount: 4999, currency: 'USD' };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/redde/webhook', () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubEnv('REDDE_WEBHOOK_SECRET', WEBHOOK_SECRET);
    const mod = await import('./route');
    POST = mod.POST;
  });

  describe('signature verification', () => {
    it('returns 401 for requests with no signature header', async () => {
      const res = await POST(makeRequest(paidEvent(), null));
      expect(res.status).toBe(401);
    });

    it('returns 401 for requests with an invalid signature', async () => {
      const res = await POST(makeRequest(paidEvent(), 'sha256=badhex'));
      expect(res.status).toBe(401);
    });

    it('returns 200 for requests with a valid signature', async () => {
      const res = await POST(makeRequest(paidEvent()));
      expect(res.status).toBe(200);
    });
  });

  describe('event handling', () => {
    it('updates order to "paid" on payment.paid', async () => {
      await POST(makeRequest(paidEvent('ord-1', 'txn-1')));
      expect(mockUpdateOrderStatus).toHaveBeenCalledWith('ord-1', 'paid', 'txn-1');
    });

    it('updates order to "failed" on payment.failed', async () => {
      const body = { event: 'payment.failed', txnId: 'txn-2', orderId: 'ord-2' };
      await POST(makeRequest(body));
      expect(mockUpdateOrderStatus).toHaveBeenCalledWith('ord-2', 'failed', 'txn-2');
    });

    it('updates order to "voided" on payment.voided', async () => {
      const body = { event: 'payment.voided', txnId: 'txn-3', orderId: 'ord-3' };
      await POST(makeRequest(body));
      expect(mockUpdateOrderStatus).toHaveBeenCalledWith('ord-3', 'voided', 'txn-3');
    });

    it('updates order to "refunded" on payment.refunded', async () => {
      const body = { event: 'payment.refunded', txnId: 'txn-4', orderId: 'ord-4' };
      await POST(makeRequest(body));
      expect(mockUpdateOrderStatus).toHaveBeenCalledWith('ord-4', 'refunded', 'txn-4');
    });

    it('returns 200 without calling updateOrderStatus for unknown event types', async () => {
      const body = { event: 'payment.unknown', txnId: 'txn-5', orderId: 'ord-5' };
      const res = await POST(makeRequest(body));
      expect(res.status).toBe(200);
      expect(mockUpdateOrderStatus).not.toHaveBeenCalled();
    });

    it('returns 200 (idempotent) when same event processed twice', async () => {
      const event = paidEvent('ord-6', 'txn-6');
      await POST(makeRequest(event));
      const res = await POST(makeRequest(event));
      expect(res.status).toBe(200);
      expect(mockUpdateOrderStatus).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('returns 400 if orderId is missing', async () => {
      const body = { event: 'payment.paid', txnId: 'txn-7' };
      const res = await POST(makeRequest(body));
      expect(res.status).toBe(400);
    });

    it('returns 500 and does not swallow if updateOrderStatus throws', async () => {
      mockUpdateOrderStatus.mockRejectedValueOnce(new Error('Firestore error'));
      const res = await POST(makeRequest(paidEvent('ord-8', 'txn-8')));
      expect(res.status).toBe(500);
    });
  });
});
