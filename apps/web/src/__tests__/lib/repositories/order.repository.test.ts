/* eslint-disable @typescript-eslint/no-unused-vars,
                  @typescript-eslint/no-unsafe-assignment,
                  @typescript-eslint/no-unsafe-member-access,
                  @typescript-eslint/require-await */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

interface FakeDocSnap {
  exists: boolean;
  id: string;
  data: () => FirebaseFirestore.DocumentData;
}

const {
  docGetMock,
  docSetMock,
  docUpdateMock,
  docRefIdMock,
  collectionMock,
  getAdminFirestoreMock,
  runTransactionMock,
  txGetMock,
  txUpdateMock,
  txSetMock,
  queryWhereMock,
  queryOrderByMock,
  queryLimitMock,
  queryStartAfterMock,
  queryGetMock,
  eventsCollectionDocMock,
  eventDocId,
} = vi.hoisted(() => {
  const docGetMock = vi.fn();
  const docSetMock = vi.fn().mockResolvedValue(undefined);
  const docUpdateMock = vi.fn().mockResolvedValue(undefined);
  const docRefIdMock = 'generated-order-id';

  // Transaction stubs
  const txGetMock = vi.fn();
  const txUpdateMock = vi.fn();
  const txSetMock = vi.fn();

  const runTransactionMock = vi.fn(async (fn: (tx: unknown) => unknown) => {
    return fn({ get: txGetMock, update: txUpdateMock, set: txSetMock });
  });

  // Query builder chain
  const queryGetMock = vi.fn();
  const queryStartAfterMock = vi.fn();
  const queryLimitMock = vi.fn();
  const queryOrderByMock = vi.fn();
  const queryWhereMock = vi.fn();

  const queryProxy: Record<string, unknown> = {};
  queryWhereMock.mockReturnValue(queryProxy);
  queryOrderByMock.mockReturnValue(queryProxy);
  queryLimitMock.mockReturnValue(queryProxy);
  queryStartAfterMock.mockReturnValue(queryProxy);
  queryGetMock.mockResolvedValue({ docs: [] });
  queryProxy.where = queryWhereMock;
  queryProxy.orderBy = queryOrderByMock;
  queryProxy.limit = queryLimitMock;
  queryProxy.startAfter = queryStartAfterMock;
  queryProxy.get = queryGetMock;

  const eventDocId = 'event-id-123';
  const eventsCollectionDocMock = vi.fn(() => ({ id: eventDocId }));

  const ordersDoc = vi.fn((id?: string) => ({
    id: id ?? docRefIdMock,
    get: docGetMock,
    set: docSetMock,
    update: docUpdateMock,
  }));

  const collectionMock = vi.fn((name: string) => {
    if (name === 'orders') {
      return {
        doc: ordersDoc,
        where: queryWhereMock,
        orderBy: queryOrderByMock,
        limit: queryLimitMock,
        startAfter: queryStartAfterMock,
        get: queryGetMock,
      };
    }
    if (name === 'order-events') {
      return {
        doc: vi.fn(() => ({
          collection: vi.fn(() => ({
            doc: eventsCollectionDocMock,
          })),
        })),
      };
    }
    return { doc: ordersDoc };
  });

  const getAdminFirestoreMock = vi.fn(() => ({
    collection: collectionMock,
    runTransaction: runTransactionMock,
  }));

  return {
    docGetMock,
    docSetMock,
    docUpdateMock,
    docRefIdMock,
    collectionMock,
    getAdminFirestoreMock,
    runTransactionMock,
    txGetMock,
    txUpdateMock,
    txSetMock,
    queryWhereMock,
    queryOrderByMock,
    queryLimitMock,
    queryStartAfterMock,
    queryGetMock,
    eventsCollectionDocMock,
    eventDocId,
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
  InvalidTransitionError,
  listOrders,
  transitionStatus,
} from '@/lib/repositories/order.repository';
import type { Order, OrderStatus } from '@/types';

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
  locationId: 'online',
  deliveryAddress: {
    name: 'Test Buyer',
    line1: '123 Main St',
    city: 'Knoxville',
    state: 'TN',
    zip: '37902',
  },
  status: 'awaiting_payment',
};

function makeOrderSnap(
  id: string,
  status: OrderStatus,
  extra: Record<string, unknown> = {}
): FakeDocSnap {
  return {
    exists: true,
    id,
    data: () => ({
      ...baseOrderData,
      status,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      ...extra,
    }),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('order.repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryGetMock.mockResolvedValue({ docs: [] });
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
      expect(order!.status).toBe('awaiting_payment');
      expect(order!.total).toBe(3270);
      expect(order!.deliveryAddress.state).toBe('TN');
    });
  });

  describe('transitionStatus — allowed moves', () => {
    it('awaiting_payment → paid: stamps paidAt + writes order-event', async () => {
      txGetMock.mockResolvedValueOnce(
        makeOrderSnap('order-1', 'awaiting_payment')
      );

      const order = await transitionStatus(
        'order-1',
        'paid',
        'webhook:clover',
        { cloverPaymentId: 'pay_123' }
      );

      // order patch
      expect(txUpdateMock).toHaveBeenCalledOnce();
      const [, patch] = txUpdateMock.mock.calls[0];
      expect(patch.status).toBe('paid');
      expect(patch.paidAt).toBeInstanceOf(Date);
      expect(patch.updatedAt).toBeInstanceOf(Date);
      expect(patch.cloverPaymentId).toBe('pay_123');

      // event log
      expect(txSetMock).toHaveBeenCalledOnce();
      const [, eventDoc] = txSetMock.mock.calls[0];
      expect(eventDoc).toMatchObject({
        orderId: 'order-1',
        from: 'awaiting_payment',
        to: 'paid',
        actor: 'webhook:clover',
      });
      expect(eventDoc.meta).toEqual({ cloverPaymentId: 'pay_123' });
      expect(eventDoc.createdAt).toBeInstanceOf(Date);

      expect(order.status).toBe('paid');
    });

    it('paid → preparing: stamps preparingAt', async () => {
      txGetMock.mockResolvedValueOnce(makeOrderSnap('order-2', 'paid'));
      await transitionStatus('order-2', 'preparing', 'admin:user-xyz');
      const [, patch] = txUpdateMock.mock.calls[0];
      expect(patch.status).toBe('preparing');
      expect(patch.preparingAt).toBeInstanceOf(Date);
    });

    it('out_for_delivery → completed: stamps completedAt and writes event with no meta', async () => {
      txGetMock.mockResolvedValueOnce(
        makeOrderSnap('order-3', 'out_for_delivery')
      );
      await transitionStatus('order-3', 'completed', 'system');
      const [, patch] = txUpdateMock.mock.calls[0];
      expect(patch.completedAt).toBeInstanceOf(Date);
      const [, event] = txSetMock.mock.calls[0];
      expect(event.meta).toBeUndefined();
      expect(event.actor).toBe('system');
    });
  });

  describe('transitionStatus — disallowed moves', () => {
    it('throws InvalidTransitionError on terminal status', async () => {
      txGetMock.mockResolvedValueOnce(makeOrderSnap('order-x', 'cancelled'));

      await expect(
        transitionStatus('order-x', 'paid', 'system')
      ).rejects.toBeInstanceOf(InvalidTransitionError);

      expect(txUpdateMock).not.toHaveBeenCalled();
      expect(txSetMock).not.toHaveBeenCalled();
    });

    it('throws InvalidTransitionError when from -> to is not in ALLOWED_TRANSITIONS', async () => {
      txGetMock.mockResolvedValueOnce(
        makeOrderSnap('order-y', 'pending_id_verification')
      );

      let caught: unknown;
      try {
        await transitionStatus('order-y', 'paid', 'system');
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(InvalidTransitionError);
      const err = caught as InvalidTransitionError;
      expect(err.from).toBe('pending_id_verification');
      expect(err.to).toBe('paid');
    });

    it('idempotency hint: re-applying the same status is rejected (not in ALLOWED_TRANSITIONS to itself)', async () => {
      txGetMock.mockResolvedValueOnce(makeOrderSnap('order-z', 'paid'));
      await expect(
        transitionStatus('order-z', 'paid', 'webhook:clover')
      ).rejects.toBeInstanceOf(InvalidTransitionError);
    });
  });

  describe('listOrders', () => {
    it('returns empty list with null cursor when no docs', async () => {
      queryGetMock.mockResolvedValueOnce({ docs: [] });
      const res = await listOrders();
      expect(res.orders).toEqual([]);
      expect(res.nextCursor).toBeNull();
    });

    it('caps limit at 100', async () => {
      queryGetMock.mockResolvedValueOnce({ docs: [] });
      await listOrders({ limit: 500 });
      expect(queryLimitMock).toHaveBeenCalledWith(100);
    });

    it('applies status + locationId filters and orders by createdAt desc', async () => {
      queryGetMock.mockResolvedValueOnce({ docs: [] });
      await listOrders({ status: 'paid', locationId: 'online' });
      expect(queryWhereMock).toHaveBeenCalledWith('status', '==', 'paid');
      expect(queryWhereMock).toHaveBeenCalledWith('locationId', '==', 'online');
      expect(queryOrderByMock).toHaveBeenCalledWith('createdAt', 'desc');
    });

    it('returns nextCursor when result fills the page', async () => {
      const docs = Array.from({ length: 2 }, (_, i) => ({
        id: `order-${i}`,
        data: () => ({
          ...baseOrderData,
          status: 'paid' as OrderStatus,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      }));
      queryGetMock.mockResolvedValueOnce({ docs });
      const res = await listOrders({ limit: 2 });
      expect(res.orders).toHaveLength(2);
      expect(res.nextCursor).toBe('order-1');
    });
  });
});
