import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { getOrderMock } = vi.hoisted(() => ({
  getOrderMock: vi.fn(),
}));

vi.mock('@/lib/repositories', () => ({
  getOrder: getOrderMock,
}));

import { GET } from '@/app/api/order/[id]/status/route';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/order/[id]/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given an order ID that does not exist', () => {
    it('returns 404 with error: Not found', async () => {
      getOrderMock.mockResolvedValue(null);

      const res = await GET(
        new Request('http://localhost/api/order/missing/status'),
        makeParams('missing')
      );

      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('Not found');
    });
  });

  describe('given an order ID that exists', () => {
    it('returns 200 with only the status field', async () => {
      getOrderMock.mockResolvedValue({
        id: 'order-123',
        status: 'pending',
        customerId: 'cust-456',
        total: 5000,
        // internal fields that should NOT be exposed
        paymentIntentId: 'pi_secret',
      });

      const res = await GET(
        new Request('http://localhost/api/order/order-123/status'),
        makeParams('order-123')
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.status).toBe('pending');
      // Ensure no other internal fields leak
      expect(body.customerId).toBeUndefined();
      expect(body.paymentIntentId).toBeUndefined();
    });

    it('calls getOrder with the route param id', async () => {
      getOrderMock.mockResolvedValue({ id: 'order-abc', status: 'confirmed' });

      await GET(
        new Request('http://localhost/api/order/order-abc/status'),
        makeParams('order-abc')
      );

      expect(getOrderMock).toHaveBeenCalledWith('order-abc');
    });
  });
});
