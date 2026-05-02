import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { runTransactionMock, collectionMock, txGetMock, txSetMock, docMap } =
  vi.hoisted(() => {
    const docMap = new Map<string, Record<string, unknown> | null>();
    const txGetMock = vi.fn();
    const txSetMock = vi.fn();

    const runTransactionMock = vi.fn(
      async (
        fn: (tx: {
          get: typeof txGetMock;
          set: typeof txSetMock;
        }) => Promise<void>
      ) => {
        await fn({ get: txGetMock, set: txSetMock });
      }
    );

    const docFactory = (id: string) => ({ id, _path: id });
    const collectionMock = vi.fn(() => ({
      doc: vi.fn((id: string) => docFactory(id)),
    }));

    return { runTransactionMock, collectionMock, txGetMock, txSetMock, docMap };
  });

vi.mock('@/lib/firebase/admin', () => ({
  getAdminFirestore: () => ({
    collection: collectionMock,
    runTransaction: runTransactionMock,
  }),
  toDate: (v: Date | string | undefined) => (v ? new Date(v) : new Date(0)),
  ONLINE_LOCATION_ID: 'online',
}));

import {
  decrementInventoryItems,
  InsufficientStockError,
} from '@/lib/repositories/inventory.repository';

function snapFor(quantity: number | undefined, exists = true) {
  return {
    exists,
    data: () =>
      exists ? { quantity, inStock: (quantity ?? 0) > 0 } : undefined,
  };
}

describe('decrementInventoryItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    docMap.clear();
  });

  describe('given sufficient stock for every item', () => {
    it('writes new quantities for each item in one transaction', async () => {
      txGetMock
        .mockResolvedValueOnce(snapFor(10))
        .mockResolvedValueOnce(snapFor(5));

      await decrementInventoryItems('oak-ridge', [
        { productId: 'prod-a', quantity: 3 },
        { productId: 'prod-b', quantity: 2 },
      ]);

      expect(runTransactionMock).toHaveBeenCalledTimes(1);
      expect(txSetMock).toHaveBeenCalledTimes(2);

      const firstWrite = txSetMock.mock.calls[0][1] as Record<string, unknown>;
      expect(firstWrite.quantity).toBe(7);
      expect(firstWrite.inStock).toBe(true);

      const secondWrite = txSetMock.mock.calls[1][1] as Record<string, unknown>;
      expect(secondWrite.quantity).toBe(3);
      expect(secondWrite.inStock).toBe(true);
    });

    it('clears featured/availablePickup when an item sells out', async () => {
      txGetMock.mockResolvedValueOnce(snapFor(2));

      await decrementInventoryItems('oak-ridge', [
        { productId: 'prod-a', quantity: 2 },
      ]);

      const write = txSetMock.mock.calls[0][1] as Record<string, unknown>;
      expect(write.quantity).toBe(0);
      expect(write.inStock).toBe(false);
      expect(write.availablePickup).toBe(false);
      expect(write.featured).toBe(false);
    });
  });

  describe('given a shortage on any item', () => {
    it('throws InsufficientStockError before any write', async () => {
      txGetMock
        .mockResolvedValueOnce(snapFor(10))
        .mockResolvedValueOnce(snapFor(1));

      await expect(
        decrementInventoryItems('oak-ridge', [
          { productId: 'prod-a', quantity: 3 },
          { productId: 'prod-b', quantity: 2 },
        ])
      ).rejects.toBeInstanceOf(InsufficientStockError);
    });
  });

  describe('given an empty item list', () => {
    it('does not start a transaction', async () => {
      await decrementInventoryItems('oak-ridge', []);
      expect(runTransactionMock).not.toHaveBeenCalled();
    });
  });
});
