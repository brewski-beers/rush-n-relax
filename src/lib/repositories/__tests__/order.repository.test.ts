import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock firebase admin ───────────────────────────────────────────────────

const mockDocRef = {
  id: 'generated-id-123',
  set: vi.fn(),
  update: vi.fn(),
  get: vi.fn(),
};

const mockOrdersCol = {
  doc: vi.fn(() => mockDocRef),
};

vi.mock('@/lib/firebase/admin', () => ({
  getAdminFirestore: vi.fn(() => ({
    collection: vi.fn(() => mockOrdersCol),
  })),
  toDate: (v: unknown) => (v instanceof Date ? v : new Date(0)),
}));

import { createOrder, getOrder, updateOrderStatus } from '../order.repository';
import type { Order } from '@/types';

const baseData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'> = {
  items: [
    {
      productId: 'prod-1',
      productName: 'Test Gummy',
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

describe('createOrder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls set with createdAt and updatedAt and returns the doc ID', async () => {
    mockDocRef.set.mockResolvedValue(undefined);

    const id = await createOrder(baseData);

    expect(id).toBe('generated-id-123');
    expect(mockDocRef.set).toHaveBeenCalledOnce();
    const [payload] = mockDocRef.set.mock.calls[0] as [Record<string, unknown>];
    expect(payload.createdAt).toBeInstanceOf(Date);
    expect(payload.updatedAt).toBeInstanceOf(Date);
    expect(payload.status).toBe('pending');
    expect(payload.total).toBe(3240);
  });
});

describe('getOrder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when document does not exist', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false, data: () => undefined });

    const result = await getOrder('nonexistent');
    expect(result).toBeNull();
  });

  it('returns mapped Order when document exists', async () => {
    const now = new Date();
    mockDocRef.get.mockResolvedValue({
      exists: true,
      id: 'generated-id-123',
      data: () => ({
        ...baseData,
        createdAt: now,
        updatedAt: now,
      }),
    });

    const result = await getOrder('generated-id-123');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('generated-id-123');
    expect(result!.status).toBe('pending');
    expect(result!.total).toBe(3240);
    expect(result!.items).toHaveLength(1);
  });
});

describe('updateOrderStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates status and updatedAt', async () => {
    mockDocRef.update.mockResolvedValue(undefined);

    await updateOrderStatus('order-1', 'paid');

    expect(mockDocRef.update).toHaveBeenCalledOnce();
    const [patch] = mockDocRef.update.mock.calls[0] as [
      Record<string, unknown>,
    ];
    expect(patch.status).toBe('paid');
    expect(patch.updatedAt).toBeInstanceOf(Date);
    expect(patch.reddeTxnId).toBeUndefined();
  });

  it('includes reddeTxnId when provided', async () => {
    mockDocRef.update.mockResolvedValue(undefined);

    await updateOrderStatus('order-1', 'paid', 'txn-abc');

    const [patch] = mockDocRef.update.mock.calls[0] as [
      Record<string, unknown>,
    ];
    expect(patch.reddeTxnId).toBe('txn-abc');
  });
});
