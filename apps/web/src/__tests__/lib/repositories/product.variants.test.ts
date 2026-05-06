/**
 * BDD coverage anchor for the #304 inventory-into-products initiative.
 *
 * This suite is the canonical pin for the variant model on `products/{slug}`:
 *   - schema: `variants[variantId].locations[locationId]` map shape
 *   - denormalized indexes: `inStockAt` / `pickupAt` / `featuredAt` recompute
 *   - repo helpers: `setVariantLocation`, `decrementVariantStock`,
 *     `listProductsInStockAt`
 *   - sell-out invariant: zero qty forces `availablePickup`/`featured` false
 *   - audit trail: `products/{slug}/adjustments/{autoId}` per write
 *
 * Sister suites pin adjacent layers — see vault docs/products.md
 * "Test coverage map" for the full grid (cart, PDP, order create, admin
 * stock actions, online-in-stock set, storefront listings).
 *
 * Finalized 2026-05-05 under issue #313.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  runTransactionMock,
  txGetMock,
  txSetMock,
  txCreateMock,
  productsCollectionMock,
  whereMock,
  orderByMock,
  limitMock,
  queryGetMock,
  docMap,
} = vi.hoisted(() => {
  const docMap = new Map<string, Record<string, unknown> | null>();
  const txGetMock = vi.fn();
  const txSetMock = vi.fn();
  const txCreateMock = vi.fn();
  const queryGetMock = vi.fn().mockResolvedValue({ docs: [] });

  const runTransactionMock = vi.fn(
    async (
      fn: (tx: {
        get: typeof txGetMock;
        set: typeof txSetMock;
        create: typeof txCreateMock;
      }) => Promise<unknown>
    ) => fn({ get: txGetMock, set: txSetMock, create: txCreateMock })
  );

  // Adjustments subcollection — `.doc()` returns a fresh autoId ref.
  const adjustmentsDoc = vi.fn(() => ({
    id: `adj-${Math.random().toString(36).slice(2)}`,
  }));
  const adjustmentsCol = vi.fn(() => ({ doc: adjustmentsDoc }));

  const productDoc = vi.fn((id: string) => ({
    id,
    _path: `products/${id}`,
    collection: adjustmentsCol,
  }));

  const whereMock = vi.fn();
  const orderByMock = vi.fn();
  const limitMock = vi.fn();
  const startAfterMock = vi.fn();

  const chain = {
    where: whereMock,
    orderBy: orderByMock,
    limit: limitMock,
    startAfter: startAfterMock,
    get: queryGetMock,
  };
  whereMock.mockReturnValue(chain);
  orderByMock.mockReturnValue(chain);
  limitMock.mockReturnValue(chain);
  startAfterMock.mockReturnValue(chain);

  const productsCollectionMock = vi.fn(() => ({
    doc: productDoc,
    where: whereMock,
    orderBy: orderByMock,
    limit: limitMock,
    startAfter: startAfterMock,
    get: queryGetMock,
  }));

  return {
    runTransactionMock,
    txGetMock,
    txSetMock,
    txCreateMock,
    productsCollectionMock,
    whereMock,
    orderByMock,
    limitMock,
    queryGetMock,
    docMap,
  };
});

vi.mock('@/lib/firebase/admin', () => ({
  getAdminFirestore: () => ({
    collection: productsCollectionMock,
    runTransaction: runTransactionMock,
  }),
  toDate: (v: Date | string | undefined) => (v ? new Date(v) : new Date(0)),
  ONLINE_LOCATION_ID: 'online',
}));

import {
  setVariantLocation,
  decrementVariantStock,
  listProductsInStockAt,
  InsufficientStockError,
} from '@/lib/repositories/product.repository';

// ── Helpers ────────────────────────────────────────────────────────────────

function productSnap(
  slug: string,
  variants: Record<
    string,
    { label: string; locations: Record<string, Record<string, unknown>> }
  >,
  extra: Record<string, unknown> = {}
) {
  return {
    id: slug,
    exists: true,
    data: () => ({
      slug,
      name: extra.name ?? `Product ${slug}`,
      category: 'flower',
      details: '',
      status: 'active',
      availableAt: [],
      variants,
      ...extra,
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  docMap.clear();
});

// ── setVariantLocation ─────────────────────────────────────────────────────

describe('setVariantLocation', () => {
  describe('given a product with an existing variant', () => {
    it('writes the patched location entry, recomputed indexes, and an audit log in one transaction', async () => {
      txGetMock.mockResolvedValueOnce(
        productSnap('blue-dream', {
          default: {
            label: 'Default',
            locations: {
              'oak-ridge': { qty: 0, price: 1500 },
            },
          },
        })
      );

      await setVariantLocation(
        'blue-dream',
        'default',
        'oak-ridge',
        { qty: 5, price: 1500, availablePickup: true, featured: true },
        { source: 'admin', actor: 'kb' }
      );

      expect(runTransactionMock).toHaveBeenCalledTimes(1);
      expect(txSetMock).toHaveBeenCalledTimes(1);
      const [, payload] = txSetMock.mock.calls[0];
      const p = payload as Record<string, unknown>;
      expect(p.inStockAt).toEqual(['oak-ridge']);
      expect(p.pickupAt).toEqual(['oak-ridge']);
      expect(p.featuredAt).toEqual(['oak-ridge']);
      const specs = p.variants as Record<
        string,
        { locations: Record<string, { qty: number }> }
      >;
      expect(specs.default.locations['oak-ridge'].qty).toBe(5);

      // Audit log written to the adjustments subcollection
      expect(txCreateMock).toHaveBeenCalledTimes(1);
      const auditPayload = txCreateMock.mock.calls[0][1] as Record<
        string,
        unknown
      >;
      expect(auditPayload.slug).toBe('blue-dream');
      expect(auditPayload.variantId).toBe('default');
      expect(auditPayload.locationId).toBe('oak-ridge');
      expect(auditPayload.delta).toBe(5);
      expect(auditPayload.source).toBe('admin');
      expect(auditPayload.actor).toBe('kb');
    });

    it('drops the location from inStockAt when the patched qty is zero', async () => {
      txGetMock.mockResolvedValueOnce(
        productSnap('blue-dream', {
          default: {
            label: 'Default',
            locations: {
              'oak-ridge': { qty: 5, price: 1500 },
              seymour: { qty: 3, price: 1500 },
            },
          },
        })
      );

      await setVariantLocation('blue-dream', 'default', 'oak-ridge', {
        qty: 0,
        price: 1500,
      });

      const payload = txSetMock.mock.calls[0][1] as Record<string, unknown>;
      expect(payload.inStockAt).toEqual(['seymour']);
    });
  });

  describe('given a missing product', () => {
    it('throws a descriptive error', async () => {
      txGetMock.mockResolvedValueOnce({
        exists: false,
        data: () => undefined,
      });
      await expect(
        setVariantLocation('ghost', 'default', 'oak-ridge', {
          qty: 1,
          price: 100,
        })
      ).rejects.toThrow("Product 'ghost' not found");
    });
  });

  describe('given a missing variant on the product', () => {
    it('throws so the caller does not silently bootstrap variants', async () => {
      txGetMock.mockResolvedValueOnce(
        productSnap('blue-dream', {
          default: { label: 'Default', locations: {} },
        })
      );
      await expect(
        setVariantLocation('blue-dream', 'eighth', 'oak-ridge', {
          qty: 1,
          price: 100,
        })
      ).rejects.toThrow("Variant 'eighth' not found on product 'blue-dream'");
    });
  });
});

// ── decrementVariantStock ──────────────────────────────────────────────────

describe('decrementVariantStock', () => {
  describe('given an empty item list', () => {
    it('does not start a transaction', async () => {
      await decrementVariantStock([]);
      expect(runTransactionMock).not.toHaveBeenCalled();
    });
  });

  describe('given sufficient stock for every line', () => {
    it('writes recomputed variants + indexes and one audit log per line', async () => {
      txGetMock.mockResolvedValueOnce(
        productSnap('blue-dream', {
          default: {
            label: 'Default',
            locations: {
              'oak-ridge': {
                qty: 10,
                price: 1500,
                availablePickup: true,
                featured: true,
              },
            },
          },
        })
      );

      await decrementVariantStock(
        [
          {
            slug: 'blue-dream',
            variantId: 'default',
            locationId: 'oak-ridge',
            qty: 3,
          },
        ],
        { source: 'order' }
      );

      expect(txSetMock).toHaveBeenCalledTimes(1);
      const payload = txSetMock.mock.calls[0][1] as Record<string, unknown>;
      const specs = payload.variants as Record<
        string,
        {
          locations: Record<string, { qty: number; availablePickup?: boolean }>;
        }
      >;
      expect(specs.default.locations['oak-ridge'].qty).toBe(7);
      expect(specs.default.locations['oak-ridge'].availablePickup).toBe(true);
      expect(payload.inStockAt).toEqual(['oak-ridge']);

      expect(txCreateMock).toHaveBeenCalledTimes(1);
      const audit = txCreateMock.mock.calls[0][1] as Record<string, unknown>;
      expect(audit.delta).toBe(-3);
      expect(audit.source).toBe('order');
    });

    it('clears availablePickup and featured when a variant sells out', async () => {
      txGetMock.mockResolvedValueOnce(
        productSnap('blue-dream', {
          default: {
            label: 'Default',
            locations: {
              'oak-ridge': {
                qty: 2,
                price: 1500,
                availablePickup: true,
                featured: true,
              },
            },
          },
        })
      );

      await decrementVariantStock([
        {
          slug: 'blue-dream',
          variantId: 'default',
          locationId: 'oak-ridge',
          qty: 2,
        },
      ]);

      const payload = txSetMock.mock.calls[0][1] as Record<string, unknown>;
      const specs = payload.variants as Record<
        string,
        {
          locations: Record<
            string,
            { qty: number; availablePickup?: boolean; featured?: boolean }
          >;
        }
      >;
      const loc = specs.default.locations['oak-ridge'];
      expect(loc.qty).toBe(0);
      expect(loc.availablePickup).toBe(false);
      expect(loc.featured).toBe(false);
      expect(payload.inStockAt).toEqual([]);
      expect(payload.pickupAt).toEqual([]);
      expect(payload.featuredAt).toEqual([]);
    });

    it('composes multiple lines against the same product/variant correctly', async () => {
      txGetMock.mockResolvedValueOnce(
        productSnap('blue-dream', {
          default: {
            label: 'Default',
            locations: { 'oak-ridge': { qty: 10, price: 1500 } },
          },
        })
      );

      await decrementVariantStock([
        {
          slug: 'blue-dream',
          variantId: 'default',
          locationId: 'oak-ridge',
          qty: 3,
        },
        {
          slug: 'blue-dream',
          variantId: 'default',
          locationId: 'oak-ridge',
          qty: 4,
        },
      ]);

      const payload = txSetMock.mock.calls[0][1] as Record<string, unknown>;
      const vs = payload.variants as Record<
        string,
        { locations: Record<string, { qty: number }> }
      >;
      expect(vs.default.locations['oak-ridge'].qty).toBe(3);
      // Audit log captures the original before-state, not intermediate.
      expect(txCreateMock).toHaveBeenCalledTimes(1);
      const audit = txCreateMock.mock.calls[0][1] as Record<string, unknown>;
      expect((audit.before as { qty: number }).qty).toBe(10);
      expect((audit.after as { qty: number }).qty).toBe(3);
      expect(audit.delta).toBe(-7);
    });
  });

  describe('given a shortage on any line', () => {
    it('throws InsufficientStockError and never writes', async () => {
      txGetMock.mockResolvedValueOnce(
        productSnap('blue-dream', {
          default: {
            label: 'Default',
            locations: { 'oak-ridge': { qty: 1, price: 1500 } },
          },
        })
      );

      await expect(
        decrementVariantStock([
          {
            slug: 'blue-dream',
            variantId: 'default',
            locationId: 'oak-ridge',
            qty: 5,
          },
        ])
      ).rejects.toBeInstanceOf(InsufficientStockError);

      expect(txSetMock).not.toHaveBeenCalled();
      expect(txCreateMock).not.toHaveBeenCalled();
    });

    it('rolls back all writes when one of several products is short', async () => {
      txGetMock
        .mockResolvedValueOnce(
          productSnap('blue-dream', {
            default: {
              label: 'Default',
              locations: { 'oak-ridge': { qty: 10, price: 1500 } },
            },
          })
        )
        .mockResolvedValueOnce(
          productSnap('og-kush', {
            default: {
              label: 'Default',
              locations: { 'oak-ridge': { qty: 1, price: 1500 } },
            },
          })
        );

      await expect(
        decrementVariantStock([
          {
            slug: 'blue-dream',
            variantId: 'default',
            locationId: 'oak-ridge',
            qty: 2,
          },
          {
            slug: 'og-kush',
            variantId: 'default',
            locationId: 'oak-ridge',
            qty: 5,
          },
        ])
      ).rejects.toBeInstanceOf(InsufficientStockError);
      // The throw occurs before tx.set runs, so no writes survive.
      expect(txSetMock).not.toHaveBeenCalled();
    });
  });

  describe('given an unknown variant', () => {
    it('throws a descriptive error', async () => {
      txGetMock.mockResolvedValueOnce(
        productSnap('blue-dream', {
          default: { label: 'Default', locations: {} },
        })
      );

      await expect(
        decrementVariantStock([
          {
            slug: 'blue-dream',
            variantId: 'eighth',
            locationId: 'oak-ridge',
            qty: 1,
          },
        ])
      ).rejects.toThrow("Variant 'eighth' not found on product 'blue-dream'");
    });
  });
});

// ── listProductsInStockAt ──────────────────────────────────────────────────

describe('listProductsInStockAt', () => {
  it('queries by status active + inStockAt array-contains, ordered by name', async () => {
    queryGetMock.mockResolvedValueOnce({
      docs: [
        {
          id: 'blue-dream',
          data: () => ({
            slug: 'blue-dream',
            name: 'Blue Dream',
            category: 'flower',
            status: 'active',
            availableAt: ['oak-ridge'],
            inStockAt: ['oak-ridge'],
          }),
        },
      ],
    });

    const result = await listProductsInStockAt('oak-ridge', { limit: 10 });

    expect(whereMock).toHaveBeenCalledWith('status', '==', 'active');
    expect(whereMock).toHaveBeenCalledWith(
      'inStockAt',
      'array-contains',
      'oak-ridge'
    );
    expect(orderByMock).toHaveBeenCalledWith('name');
    expect(limitMock).toHaveBeenCalledWith(10);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].slug).toBe('blue-dream');
    expect(result.nextCursor).toBeNull();
  });

  it('returns nextCursor when the page is full', async () => {
    const docs = Array.from({ length: 25 }, (_, i) => ({
      id: `p-${i}`,
      data: () => ({
        slug: `p-${i}`,
        name: `P ${i}`,
        category: 'flower',
        status: 'active',
        availableAt: [],
        inStockAt: ['oak-ridge'],
      }),
    }));
    queryGetMock.mockResolvedValueOnce({ docs });
    const result = await listProductsInStockAt('oak-ridge');
    expect(result.items).toHaveLength(25);
    expect(result.nextCursor).toBe('p-24');
  });
});
