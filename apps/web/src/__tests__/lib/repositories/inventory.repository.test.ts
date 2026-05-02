import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  itemGetMock,
  itemSetMock,
  productGetMock,
  batchSetMock,
  batchCommitMock,
  adjustmentDocMock,
  collectionMock,
  getAdminFirestoreMock,
} = vi.hoisted(() => {
  const itemGetMock = vi.fn();
  const itemSetMock = vi.fn().mockResolvedValue(undefined);
  const productGetMock = vi.fn();
  const batchSetMock = vi.fn();
  const batchCommitMock = vi.fn().mockResolvedValue(undefined);

  // Represents the auto-id doc ref for the adjustments subcollection
  const adjustmentDocId = 'adj-auto-id';
  const adjustmentDocMock = vi.fn(() => ({
    id: adjustmentDocId,
    set: batchSetMock,
  }));

  // itemRef — the inventory item document ref
  const makeItemRef = (productId: string) => ({
    id: productId,
    get: itemGetMock,
    set: itemSetMock,
    collection: vi.fn(() => ({
      // adjustments subcollection
      doc: adjustmentDocMock,
    })),
  });

  // productRef — the products collection doc ref
  const makeProductRef = () => ({
    get: productGetMock,
  });

  // collectionMock handles both top-level collections:
  //   'products'                     → doc() returns productRef
  //   'inventory/{loc}/items'        → doc() returns itemRef
  const collectionMock = vi.fn((path: string) => ({
    doc: vi.fn((id: string) => {
      if (path === 'products') return makeProductRef();
      // inventory subcollection path looks like "inventory/oak-ridge/items"
      return makeItemRef(id);
    }),
    where: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue({ docs: [] }),
  }));

  const getAdminFirestoreMock = vi.fn(() => ({
    collection: collectionMock,
    batch: vi.fn(() => ({
      set: batchSetMock,
      commit: batchCommitMock,
    })),
  }));

  return {
    itemGetMock,
    itemSetMock,
    productGetMock,
    batchSetMock,
    batchCommitMock,
    adjustmentDocMock,
    collectionMock,
    getAdminFirestoreMock,
  };
});

vi.mock('@/lib/firebase/admin', () => ({
  getAdminFirestore: getAdminFirestoreMock,
  toDate: (value: Date | string | undefined) =>
    value ? new Date(value) : new Date(0),
  ONLINE_LOCATION_ID: 'online',
}));

import { setInventoryItem } from '@/lib/repositories/inventory.repository';

// ── Helpers ────────────────────────────────────────────────────────────────

function stubCurrentItem(data: Record<string, unknown> | null) {
  itemGetMock.mockResolvedValue(
    data
      ? { exists: true, data: () => data }
      : { exists: false, data: () => undefined }
  );
}

function stubProduct(status: string | null) {
  productGetMock.mockResolvedValue(
    status !== null
      ? { exists: true, data: () => ({ status }) }
      : { exists: false, data: () => undefined }
  );
}

// ── normalizeQuantity (tested via setInventoryItem behaviour) ─────────────

describe('inventory.repository — normalizeQuantity invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given quantity: -5 on a new item', () => {
    it('clamps to 0 and sets inStock = false', async () => {
      stubCurrentItem(null);
      stubProduct(null);

      await setInventoryItem('oak-ridge', 'product-a', { quantity: -5 });

      expect(itemSetMock).toHaveBeenCalledOnce();
      const [payload] = itemSetMock.mock.calls[0] as [Record<string, unknown>];
      expect(payload.quantity).toBe(0);
      expect(payload.inStock).toBe(false);
    });
  });

  describe('given quantity: 4.9 on a new item', () => {
    it('floors to 4 and sets inStock = true', async () => {
      stubCurrentItem(null);
      stubProduct(null);

      await setInventoryItem('oak-ridge', 'product-a', { quantity: 4.9 });

      expect(itemSetMock).toHaveBeenCalledOnce();
      const [payload] = itemSetMock.mock.calls[0] as [Record<string, unknown>];
      expect(payload.quantity).toBe(4);
      expect(payload.inStock).toBe(true);
    });
  });
});

// ── setInventoryItem — availableOnline retirement (#232) ──────────────────

describe('setInventoryItem — availableOnline is no longer persisted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given an item with availableOnline: true requested', () => {
    it('omits availableOnline from the written item payload', async () => {
      stubCurrentItem({
        quantity: 5,
        inStock: true,
        availablePickup: false,
        featured: false,
        locationId: 'online',
      });
      stubProduct(null); // no compliance status → no throw

      await setInventoryItem(
        'online',
        'product-a',
        { availableOnline: true },
        {
          reason: 'toggle-online',
          updatedBy: 'admin@example.com',
          source: 'admin-ui',
        }
      );

      expect(batchCommitMock).toHaveBeenCalledOnce();
      const [, itemPayload] = batchSetMock.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
      ];
      expect(itemPayload).not.toHaveProperty('availableOnline');
    });
  });
});

// ── setInventoryItem — zero-quantity invariants ───────────────────────────

describe('setInventoryItem — quantity: 0 clears availability flags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given an item currently in stock with flags true', () => {
    it('when quantity is set to 0, inStock / availablePickup / featured all become false', async () => {
      stubCurrentItem({
        quantity: 10,
        inStock: true,
        availablePickup: true,
        featured: true,
        locationId: 'online',
      });
      productGetMock.mockResolvedValue({
        exists: false,
        data: () => undefined,
      });

      await setInventoryItem(
        'online',
        'product-a',
        { quantity: 0 },
        {
          reason: 'manual-count',
          updatedBy: 'admin@example.com',
          source: 'admin-ui',
        }
      );

      expect(batchCommitMock).toHaveBeenCalledOnce();
      const [, itemPayload] = batchSetMock.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
      ];
      expect(itemPayload.quantity).toBe(0);
      expect(itemPayload.inStock).toBe(false);
      expect(itemPayload.availablePickup).toBe(false);
      expect(itemPayload.featured).toBe(false);
    });
  });
});

// ── setInventoryItem — featured requires inStock (all locations) ──────────

describe('setInventoryItem — featured requires inStock at every location', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given an online-store item inStock with featured: true requested', () => {
    it('persists featured = true (availableOnline is no longer a precondition)', async () => {
      stubCurrentItem({
        quantity: 5,
        inStock: true,
        availablePickup: false,
        featured: false,
        locationId: 'online',
      });
      productGetMock.mockResolvedValue({
        exists: false,
        data: () => undefined,
      });

      await setInventoryItem(
        'online',
        'product-b',
        { featured: true },
        {
          reason: 'toggle-featured',
          updatedBy: 'admin@example.com',
          source: 'admin-ui',
        }
      );

      expect(batchCommitMock).toHaveBeenCalledOnce();
      const [, itemPayload] = batchSetMock.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
      ];
      expect(itemPayload.featured).toBe(true);
    });
  });
});

// ── setInventoryItem — compliance guard ───────────────────────────────────

describe('setInventoryItem — compliance-hold blocks availableOnline / availablePickup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a product on compliance-hold when availableOnline: true is requested', () => {
    it('throws without writing any document (legacy intent still gated)', async () => {
      stubCurrentItem({
        quantity: 5,
        inStock: true,
        availablePickup: false,
        featured: false,
        locationId: 'online',
      });
      stubProduct('compliance-hold');

      await expect(
        setInventoryItem(
          'online',
          'product-hold',
          { availableOnline: true },
          {
            reason: 'toggle-online',
            updatedBy: 'admin@example.com',
            source: 'admin-ui',
          }
        )
      ).rejects.toThrow(
        "Cannot mark 'product-hold' available for purchase: product is on compliance-hold"
      );

      expect(itemSetMock).not.toHaveBeenCalled();
      expect(batchCommitMock).not.toHaveBeenCalled();
    });
  });

  describe('given a product on compliance-hold when availablePickup: true is requested', () => {
    it('throws without writing any document', async () => {
      stubCurrentItem({
        quantity: 5,
        inStock: true,
        availablePickup: false,
        featured: false,
        locationId: 'oak-ridge',
      });
      stubProduct('compliance-hold');

      await expect(
        setInventoryItem(
          'oak-ridge',
          'product-hold',
          { availablePickup: true },
          {
            reason: 'toggle-pickup',
            updatedBy: 'admin@example.com',
            source: 'admin-ui',
          }
        )
      ).rejects.toThrow("Cannot mark 'product-hold' available for purchase");

      expect(itemSetMock).not.toHaveBeenCalled();
      expect(batchCommitMock).not.toHaveBeenCalled();
    });
  });
});

// ── setInventoryItem — audit log written atomically ───────────────────────

describe('setInventoryItem — audit log written atomically with item update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a valid update with adjustment metadata', () => {
    it('uses a batch write and records correct delta fields', async () => {
      stubCurrentItem({
        quantity: 3,
        inStock: true,
        availablePickup: false,
        featured: false,
        locationId: 'oak-ridge',
      });
      productGetMock.mockResolvedValue({
        exists: false,
        data: () => undefined,
      });

      await setInventoryItem(
        'oak-ridge',
        'product-c',
        { quantity: 10 },
        {
          reason: 'manual-count',
          updatedBy: 'admin@example.com',
          source: 'admin-ui',
        }
      );

      expect(batchCommitMock).toHaveBeenCalledOnce();
      expect(batchSetMock).toHaveBeenCalledTimes(2);

      const [, logPayload] = batchSetMock.mock.calls[1] as [
        unknown,
        Record<string, unknown>,
      ];
      expect(logPayload.previousQuantity).toBe(3);
      expect(logPayload.nextQuantity).toBe(10);
      expect(logPayload.deltaQuantity).toBe(7);
      expect(logPayload.updatedBy).toBe('admin@example.com');
      expect(logPayload.reason).toBe('manual-count');
      expect(logPayload.source).toBe('admin-ui');
      expect(logPayload.changedFields as string[]).toContain('quantity');
      // availableOnline is retired — always false in audit log
      expect(logPayload.previousAvailableOnline).toBe(false);
      expect(logPayload.nextAvailableOnline).toBe(false);
      expect(logPayload.changedFields as string[]).not.toContain(
        'availableOnline'
      );
    });
  });

  describe('given a system/seed write with no adjustment parameter', () => {
    it('calls itemRef.set directly — no batch, no audit log', async () => {
      stubCurrentItem(null);
      productGetMock.mockResolvedValue({
        exists: false,
        data: () => undefined,
      });

      await setInventoryItem('oak-ridge', 'product-seed', {
        quantity: 5,
        inStock: true,
      });

      expect(itemSetMock).toHaveBeenCalledOnce();
      expect(batchCommitMock).not.toHaveBeenCalled();
    });
  });
});

// ── docToInventoryItem mapping ────────────────────────────────────────────

describe('inventory.repository — docToInventoryItem mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a Firestore doc with all fields present', () => {
    it('maps productId from doc.id, not d.productId', async () => {
      itemGetMock.mockResolvedValue({
        id: 'product-xyz',
        exists: true,
        data: () => ({
          locationId: 'oak-ridge',
          quantity: 7,
          inStock: true,
          availablePickup: true,
          featured: true,
          notes: 'low stock',
          updatedAt: new Date('2024-01-01'),
          updatedBy: 'admin@rushnrelax.com',
        }),
      });

      const { getInventoryItem } =
        await import('@/lib/repositories/inventory.repository');
      const item = await getInventoryItem('oak-ridge', 'product-xyz');

      expect(item).not.toBeNull();
      expect(item!.productId).toBe('product-xyz');
      expect(item!.locationId).toBe('oak-ridge');
      expect(item!.quantity).toBe(7);
      expect(item!.inStock).toBe(true);
      expect(item!.availablePickup).toBe(true);
      expect(item!.featured).toBe(true);
      expect(item!.notes).toBe('low stock');
      expect(item!.updatedBy).toBe('admin@rushnrelax.com');
      // availableOnline is no longer read/returned by the mapper
      expect(item!.availableOnline).toBeUndefined();
    });
  });

  describe('given a Firestore doc with inStock: false', () => {
    it('forces availablePickup and featured to false regardless of stored values', async () => {
      itemGetMock.mockResolvedValue({
        id: 'product-out',
        exists: true,
        data: () => ({
          locationId: 'online',
          quantity: 0,
          inStock: false,
          availablePickup: true,
          featured: true,
        }),
      });

      const { getInventoryItem } =
        await import('@/lib/repositories/inventory.repository');
      const item = await getInventoryItem('online', 'product-out');

      expect(item!.inStock).toBe(false);
      expect(item!.availablePickup).toBe(false);
      expect(item!.featured).toBe(false);
    });
  });
});
