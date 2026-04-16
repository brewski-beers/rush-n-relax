import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  docGetMock,
  docSetMock,
  docUpdateMock,
  collectionMock,
  getAdminFirestoreMock,
} = vi.hoisted(() => {
  const docGetMock = vi.fn();
  const docSetMock = vi.fn().mockResolvedValue(undefined);
  const docUpdateMock = vi.fn().mockResolvedValue(undefined);

  // doc() returns a stable ref with a deterministic id
  const docMock = vi.fn((id?: string) => ({
    id: id ?? 'generated-id',
    get: docGetMock,
    set: docSetMock,
    update: docUpdateMock,
  }));

  const collectionMock = vi.fn(() => ({
    doc: docMock,
  }));

  const getAdminFirestoreMock = vi.fn(() => ({
    collection: collectionMock,
  }));

  return {
    docGetMock,
    docSetMock,
    docUpdateMock,
    docMock,
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

function makeDocSnapshot(
  id: string,
  data: Record<string, unknown> | null
): {
  id: string;
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
} {
  return {
    id,
    exists: data !== null,
    data: () => data ?? undefined,
  };
}

const baseOrderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'> = {
  items: [
    {
      productId: 'blue-dream',
      productName: 'Blue Dream',
      quantity: 2,
      unitPrice: 1500,
      lineTotal: 3000,
    },
  ],
  subtotal: 3000,
  tax: 240,
  total: 3240,
  locationId: 'oak-ridge',
  fulfillmentType: 'pickup',
  status: 'pending',
};

// ── createOrder ────────────────────────────────────────────────────────────

describe('createOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a valid order payload', () => {
    it('calls set with createdAt and updatedAt and returns the generated ID', async () => {
      const id = await createOrder(baseOrderData);

      expect(id).toBe('generated-id');
      expect(docSetMock).toHaveBeenCalledOnce();
      const [payload] = docSetMock.mock.calls[0] as [Record<string, unknown>];
      expect(payload.status).toBe('pending');
      expect(payload.createdAt).toBeInstanceOf(Date);
      expect(payload.updatedAt).toBeInstanceOf(Date);
    });

    it('does not include an id field in the set payload', async () => {
      await createOrder(baseOrderData);
      const [payload] = docSetMock.mock.calls[0] as [Record<string, unknown>];
      expect('id' in payload).toBe(false);
    });
  });
});

// ── getOrder ───────────────────────────────────────────────────────────────

describe('getOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a non-existent order ID', () => {
    it('returns null', async () => {
      docGetMock.mockResolvedValue(makeDocSnapshot('order-abc', null));

      const result = await getOrder('order-abc');

      expect(result).toBeNull();
    });
  });

  describe('given an existing order ID', () => {
    it('returns the full order with all fields mapped', async () => {
      const now = new Date('2026-01-01T00:00:00.000Z').toISOString();
      docGetMock.mockResolvedValue(
        makeDocSnapshot('order-abc', {
          ...baseOrderData,
          createdAt: now,
          updatedAt: now,
        })
      );

      const result = await getOrder('order-abc');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('order-abc');
      expect(result!.status).toBe('pending');
      expect(result!.total).toBe(3240);
      expect(result!.createdAt).toBeInstanceOf(Date);
    });

    it('maps optional customerEmail when present', async () => {
      const now = new Date().toISOString();
      docGetMock.mockResolvedValue(
        makeDocSnapshot('order-xyz', {
          ...baseOrderData,
          status: 'paid',
          customerEmail: 'customer@example.com',
          createdAt: now,
          updatedAt: now,
        })
      );

      const result = await getOrder('order-xyz');

      expect(result!.customerEmail).toBe('customer@example.com');
    });

    it('returns undefined for optional customerEmail when absent', async () => {
      const now = new Date().toISOString();
      docGetMock.mockResolvedValue(
        makeDocSnapshot('order-xyz', {
          ...baseOrderData,
          createdAt: now,
          updatedAt: now,
        })
      );

      const result = await getOrder('order-xyz');

      expect(result!.customerEmail).toBeUndefined();
    });

    it('uses safe defaults for missing numeric fields', async () => {
      const now = new Date().toISOString();
      docGetMock.mockResolvedValue(
        makeDocSnapshot('order-defaults', {
          items: [],
          locationId: 'oak-ridge',
          fulfillmentType: 'pickup',
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        })
      );

      const result = await getOrder('order-defaults');

      expect(result!.subtotal).toBe(0);
      expect(result!.tax).toBe(0);
      expect(result!.total).toBe(0);
    });
  });
});

// ── updateOrderStatus ──────────────────────────────────────────────────────

describe('updateOrderStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a status update', () => {
    it('calls update with the new status and a fresh updatedAt', async () => {
      await updateOrderStatus('order-abc', 'paid');

      expect(docUpdateMock).toHaveBeenCalledOnce();
      const [payload] = docUpdateMock.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(payload.status).toBe('paid');
      expect(payload.updatedAt).toBeInstanceOf(Date);
    });

    it('does not include any payment-processor-specific fields', async () => {
      await updateOrderStatus('order-abc', 'paid');

      const [payload] = docUpdateMock.mock.calls[0] as [
        Record<string, unknown>,
      ];
      // Only status and updatedAt — no internal payment fields
      expect(Object.keys(payload).sort()).toEqual(['status', 'updatedAt']);
    });
  });
});
