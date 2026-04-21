import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  docGetMock,
  docSetMock,
  docUpdateMock,
  docRefIdMock,
  collectionMock,
  getAdminFirestoreMock,
} = vi.hoisted(() => {
  const docGetMock = vi.fn();
  const docSetMock = vi.fn().mockResolvedValue(undefined);
  const docUpdateMock = vi.fn().mockResolvedValue(undefined);
  const docRefIdMock = 'generated-order-id';

  const collectionMock = vi.fn(() => ({
    doc: vi.fn((id?: string) => ({
      id: id ?? docRefIdMock,
      get: docGetMock,
      set: docSetMock,
      update: docUpdateMock,
    })),
  }));

  const getAdminFirestoreMock = vi.fn(() => ({
    collection: collectionMock,
  }));

  return {
    docGetMock,
    docSetMock,
    docUpdateMock,
    docRefIdMock,
    collectionMock,
    getAdminFirestoreMock,
  };
});

vi.mock('@/lib/firebase/admin', () => ({
  getAdminFirestore: getAdminFirestoreMock,
  toDate: (value: Date | string | undefined) =>
    value ? new Date(value) : new Date(0),
}));

import {
  createOrder,
  getOrder,
  updateOrderStatus,
} from '@/lib/repositories/order.repository';
import type { Order } from '@/types';

// ── Helpers ────────────────────────────────────────────────────────────────

const baseOrderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'> = {
  items: [
    {
      productId: 'prod-1',
      productName: 'Blue Dream',
      quantity: 2,
      unitPrice: 1500,
      lineTotal: 3000,
    },
  ],
  subtotal: 3000,
  tax: 270,
  total: 3270,
  locationId: 'oak-ridge',
  fulfillmentType: 'pickup',
  status: 'pending',
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('order.repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createOrder', () => {
    it('auto-generates an ID and calls set with createdAt + updatedAt', async () => {
      const id = await createOrder(baseOrderData);

      expect(id).toBe('generated-order-id');
      expect(docSetMock).toHaveBeenCalledOnce();

      const [payload] = docSetMock.mock.calls[0];
      expect(payload).toMatchObject(baseOrderData);
      expect(payload.createdAt).toBeInstanceOf(Date);
      expect(payload.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('getOrder', () => {
    it('returns null when document does not exist', async () => {
      docGetMock.mockResolvedValueOnce({ exists: false });
      const result = await getOrder('does-not-exist');
      expect(result).toBeNull();
    });

    it('returns a hydrated Order when document exists', async () => {
      const now = new Date('2026-01-01T00:00:00Z');
      docGetMock.mockResolvedValueOnce({
        exists: true,
        id: 'order-abc',
        data: () => ({
          ...baseOrderData,
          createdAt: now,
          updatedAt: now,
        }),
      });

      const order = await getOrder('order-abc');
      expect(order).not.toBeNull();
      expect(order!.id).toBe('order-abc');
      expect(order!.status).toBe('pending');
      expect(order!.total).toBe(3270);
      expect(order!.items).toHaveLength(1);
    });
  });

  describe('updateOrderStatus', () => {
    it('updates status and updatedAt', async () => {
      await updateOrderStatus('order-abc', 'paid');

      expect(docUpdateMock).toHaveBeenCalledOnce();
      const [payload] = docUpdateMock.mock.calls[0];
      expect(payload.status).toBe('paid');
      expect(payload.updatedAt).toBeInstanceOf(Date);
      expect(payload.cloverPaymentId).toBeUndefined();
    });

    it('includes cloverPaymentId when provided', async () => {
      await updateOrderStatus('order-abc', 'paid', 'txn-xyz');

      const [payload] = docUpdateMock.mock.calls[0];
      expect(payload.cloverPaymentId).toBe('txn-xyz');
    });
  });
});
