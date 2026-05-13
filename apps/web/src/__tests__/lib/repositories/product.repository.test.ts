import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  docGetMock,
  docSetMock,
  docUpdateMock,
  colGetMock,
  getAdminFirestoreMock,
  txGetMock,
  txSetMock,
  fieldValueDeleteSentinel,
} = vi.hoisted(() => {
  const docGetMock = vi.fn();
  const docSetMock = vi.fn().mockResolvedValue(undefined);
  const docUpdateMock = vi.fn().mockResolvedValue(undefined);
  const colGetMock = vi.fn().mockResolvedValue({ docs: [] });

  const txGetMock = vi.fn();
  const txSetMock = vi.fn();
  const txCreateMock = vi.fn();
  const runTransactionMock = vi.fn(
    async (
      fn: (tx: {
        get: typeof txGetMock;
        set: typeof txSetMock;
        create: typeof txCreateMock;
      }) => Promise<unknown>
    ) => fn({ get: txGetMock, set: txSetMock, create: txCreateMock })
  );

  // Sentinel value used by `firebase-admin/firestore`'s FieldValue.delete().
  // We assert by reference identity in the self-pruning suite below.
  const fieldValueDeleteSentinel = { __op: 'delete' } as const;

  // Adjustments subcollection — `.doc()` returns a fresh autoId-style ref.
  const adjustmentsDoc = vi.fn(() => ({
    id: `adj-${Math.random().toString(36).slice(2)}`,
  }));
  const adjustmentsCol = vi.fn(() => ({ doc: adjustmentsDoc }));

  const productDoc = vi.fn((id: string) => ({
    id,
    get: docGetMock,
    set: docSetMock,
    update: docUpdateMock,
    collection: adjustmentsCol,
  }));

  const collectionMock = vi.fn(() => ({
    doc: productDoc,
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    startAfter: vi.fn().mockReturnThis(),
    get: colGetMock,
  }));

  const getAdminFirestoreMock = vi.fn(() => ({
    collection: collectionMock,
    runTransaction: runTransactionMock,
  }));

  return {
    docGetMock,
    docSetMock,
    docUpdateMock,
    colGetMock,
    getAdminFirestoreMock,
    txGetMock,
    txSetMock,
    fieldValueDeleteSentinel,
  };
});

vi.mock('@/lib/firebase/admin', () => ({
  getAdminFirestore: getAdminFirestoreMock,
  toDate: (value: Date | string | undefined) =>
    value ? new Date(value) : new Date(0),
  ONLINE_LOCATION_ID: 'online',
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    delete: () => fieldValueDeleteSentinel,
  },
}));

import {
  listProductsByIds,
  setProductStatus,
  upsertProduct,
  getProductBySlug,
  listProducts,
  listAllProducts,
  listProductsByCategory,
  getRelatedProducts,
  setVariantLocation,
  decrementVariantStock,
  holdStock,
  releaseStock,
  commitStock,
  recomputeProductIndexes,
} from '@/lib/repositories/product.repository';

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

// ── listProductsByIds ──────────────────────────────────────────────────────

describe('listProductsByIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given an empty slugs array', () => {
    it('returns an empty array without making any Firestore calls', async () => {
      const result = await listProductsByIds([]);

      expect(result).toEqual([]);
      expect(docGetMock).not.toHaveBeenCalled();
    });
  });

  describe('given a mix of active and archived products', () => {
    it('returns only active products, sorted by name', async () => {
      const activeA = makeDocSnapshot('product-a', {
        slug: 'product-a',
        name: 'Zebra OG',
        category: 'flower',
        description: 'Great strain',
        status: 'active',
        availableAt: [],
      });
      const archivedB = makeDocSnapshot('product-b', {
        slug: 'product-b',
        name: 'Apple Fritter',
        category: 'flower',
        description: 'Sweet',
        status: 'archived',
        availableAt: [],
      });
      const activeC = makeDocSnapshot('product-c', {
        slug: 'product-c',
        name: 'Blue Dream',
        category: 'flower',
        description: 'Classic',
        status: 'active',
        availableAt: [],
      });

      // Promise.all resolves in slug order; each call to productsCol().doc(slug).get()
      // is a separate docGetMock invocation.
      docGetMock
        .mockResolvedValueOnce(activeA)
        .mockResolvedValueOnce(archivedB)
        .mockResolvedValueOnce(activeC);

      const result = await listProductsByIds([
        'product-a',
        'product-b',
        'product-c',
      ]);

      expect(result).toHaveLength(2);
      // Sorted by name: Blue Dream < Zebra OG
      expect(result[0].slug).toBe('product-c');
      expect(result[1].slug).toBe('product-a');
    });
  });

  describe('given slugs where a document does not exist', () => {
    it('silently skips missing documents', async () => {
      const existing = makeDocSnapshot('product-a', {
        slug: 'product-a',
        name: 'Sunset Sherbet',
        category: 'concentrate',
        description: 'Tasty',
        status: 'active',
        availableAt: [],
      });
      const missing = makeDocSnapshot('product-missing', null);

      docGetMock.mockResolvedValueOnce(existing).mockResolvedValueOnce(missing);

      const result = await listProductsByIds(['product-a', 'product-missing']);

      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('product-a');
    });
  });
});

// ── setProductStatus ───────────────────────────────────────────────────────

describe('setProductStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a non-existent product slug', () => {
    it('throws a descriptive error containing the slug', async () => {
      docGetMock.mockResolvedValue(makeDocSnapshot('ghost-product', null));

      await expect(
        setProductStatus('ghost-product', 'archived')
      ).rejects.toThrow("Product 'ghost-product' not found");

      expect(docUpdateMock).not.toHaveBeenCalled();
    });
  });

  describe('given an existing product', () => {
    it('calls docRef.update with the new status and a fresh updatedAt timestamp', async () => {
      docGetMock.mockResolvedValue(
        makeDocSnapshot('product-a', {
          slug: 'product-a',
          name: 'Something',
          status: 'active',
        })
      );

      await setProductStatus('product-a', 'compliance-hold');

      expect(docUpdateMock).toHaveBeenCalledOnce();
      const [updatePayload] = docUpdateMock.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(updatePayload.status).toBe('compliance-hold');
      expect(updatePayload.updatedAt).toBeInstanceOf(Date);
    });
  });
});

// ── upsertProduct ──────────────────────────────────────────────────────────

describe('upsertProduct', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a valid product payload', () => {
    it('calls set with merge: true and returns the slug', async () => {
      const result = await upsertProduct({
        slug: 'blue-dream',
        name: 'Blue Dream',
        category: 'flower',
        details: 'Smooth and uplifting',
        status: 'active',
        availableAt: ['oak-ridge'],
      });

      expect(result).toBe('blue-dream');
      expect(docSetMock).toHaveBeenCalledOnce();
      const [payload, options] = docSetMock.mock.calls[0] as [
        Record<string, unknown>,
        Record<string, unknown>,
      ];
      expect(payload.slug).toBe('blue-dream');
      expect(payload.name).toBe('Blue Dream');
      expect(payload.updatedAt).toBeInstanceOf(Date);
      expect(options).toEqual({ merge: true });
    });

    it('strips undefined optional fields from the payload', async () => {
      await upsertProduct({
        slug: 'blue-dream',
        name: 'Blue Dream',
        category: 'flower',
        details: 'Details',
        status: 'active',
        availableAt: [],
        // image intentionally absent
      });

      const [payload] = docSetMock.mock.calls[0] as [Record<string, unknown>];
      expect('image' in payload).toBe(false);
    });
  });
});

// ── getProductBySlug ───────────────────────────────────────────────────────

describe('getProductBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a non-existent slug', () => {
    it('returns null', async () => {
      docGetMock.mockResolvedValue(makeDocSnapshot('ghost', null));

      const result = await getProductBySlug('ghost');

      expect(result).toBeNull();
    });
  });

  describe('given an existing slug', () => {
    it('returns the full product with all fields mapped', async () => {
      docGetMock.mockResolvedValue(
        makeDocSnapshot('blue-dream', {
          slug: 'blue-dream',
          name: 'Blue Dream',
          category: 'flower',
          description: 'Classic sativa',
          details: 'Smooth',
          status: 'active',
          availableAt: ['oak-ridge'],
          createdAt: new Date('2024-01-01').toISOString(),
          updatedAt: new Date('2024-06-01').toISOString(),
        })
      );

      const result = await getProductBySlug('blue-dream');

      expect(result).not.toBeNull();
      expect(result!.slug).toBe('blue-dream');
      expect(result!.name).toBe('Blue Dream');
      expect(result!.status).toBe('active');
    });

    it('defaults optional fields correctly', async () => {
      docGetMock.mockResolvedValue(
        makeDocSnapshot('blue-dream', {
          slug: 'blue-dream',
          name: 'Blue Dream',
          // coaUrl absent
          // image absent
        })
      );

      const result = await getProductBySlug('blue-dream');

      expect(result!.coaUrl).toBeUndefined();
      expect(result!.image).toBeUndefined();
    });
  });
});

// ── listProducts ───────────────────────────────────────────────────────────

describe('listProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given active products exist', () => {
    it('returns summaries for active products', async () => {
      colGetMock.mockResolvedValue({
        docs: [
          makeDocSnapshot('blue-dream', {
            slug: 'blue-dream',
            name: 'Blue Dream',
            category: 'flower',
            description: 'Classic',
            status: 'active',
            availableAt: [],
          }),
        ],
      });

      const result = await listProducts();

      expect(result.items).toHaveLength(1);
      expect(result.items[0].slug).toBe('blue-dream');
    });
  });

  describe('given no active products', () => {
    it('returns an empty array', async () => {
      colGetMock.mockResolvedValue({ docs: [] });

      const result = await listProducts();

      expect(result.items).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });
  });

  describe('given a full page of results', () => {
    it('returns nextCursor as the orderBy `name` value (not the slug)', async () => {
      const docs = ['a', 'b', 'c'].map((letter, i) =>
        makeDocSnapshot(`slug-${i}`, {
          slug: `slug-${i}`,
          name: `Name ${letter.toUpperCase()}`,
          category: 'flower',
          description: '',
          status: 'active',
          availableAt: [],
        })
      );
      colGetMock.mockResolvedValue({ docs });

      const result = await listProducts({ limit: 3 });

      expect(result.items).toHaveLength(3);
      expect(result.nextCursor).toBe('Name C');
    });
  });

  describe('given a search filter', () => {
    beforeEach(() => {
      // Docs are returned in `orderBy('name')` order — the repository trusts
      // Firestore's ordering and does not re-sort in memory.
      const docs = [
        ['blue-dream', 'Blue Dream'],
        ['gelato', 'Gelato'],
        ['mango-fizz', 'Mango Fizz'],
        ['mango-kush', 'Mango Kush'],
        ['og-kush', 'OG Kush'],
      ].map(([slug, name]) =>
        makeDocSnapshot(slug, {
          slug,
          name,
          category: 'flower',
          description: '',
          status: 'active',
          availableAt: [],
        })
      );
      colGetMock.mockResolvedValue({ docs });
    });

    it('filters by case-insensitive substring on name', async () => {
      const result = await listProducts({ search: 'mango' });

      expect(result.items.map(p => p.name)).toEqual([
        'Mango Fizz',
        'Mango Kush',
      ]);
      expect(result.nextCursor).toBeNull();
    });

    it('trims whitespace and matches mixed case', async () => {
      const result = await listProducts({ search: '  KUSH  ' });

      expect(result.items.map(p => p.name)).toEqual(['Mango Kush', 'OG Kush']);
    });

    it('paginates filtered results via the name cursor', async () => {
      const firstPage = await listProducts({ search: 'kush', limit: 1 });
      expect(firstPage.items.map(p => p.name)).toEqual(['Mango Kush']);
      expect(firstPage.nextCursor).toBe('Mango Kush');

      const nextPage = await listProducts({
        search: 'kush',
        limit: 1,
        cursor: 'Mango Kush',
      });
      expect(nextPage.items.map(p => p.name)).toEqual(['OG Kush']);
      expect(nextPage.nextCursor).toBeNull();
    });

    it('returns no items when nothing matches', async () => {
      const result = await listProducts({ search: 'nope' });

      expect(result.items).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });
  });
});

// ── listAllProducts ────────────────────────────────────────────────────────

describe('listAllProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a mix of active and archived products', () => {
    it('returns all products regardless of status', async () => {
      colGetMock.mockResolvedValue({
        docs: [
          makeDocSnapshot('archived-product', {
            slug: 'archived-product',
            name: 'Archived Product',
            category: 'concentrate',
            description: 'Old',
            status: 'archived',
            availableAt: [],
          }),
          makeDocSnapshot('blue-dream', {
            slug: 'blue-dream',
            name: 'Blue Dream',
            category: 'flower',
            description: 'Classic',
            status: 'active',
            availableAt: [],
          }),
        ],
      });

      const result = await listAllProducts();

      expect(result.items).toHaveLength(2);
    });
  });
});

// ── listProductsByCategory ─────────────────────────────────────────────────

describe('listProductsByCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given active products in a category', () => {
    it('returns summaries for matching products', async () => {
      colGetMock.mockResolvedValue({
        docs: [
          makeDocSnapshot('blue-dream', {
            slug: 'blue-dream',
            name: 'Blue Dream',
            category: 'flower',
            description: 'Classic',
            status: 'active',
            availableAt: [],
          }),
        ],
      });

      const result = await listProductsByCategory('flower');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].category).toBe('flower');
    });
  });

  describe('given no products in the category', () => {
    it('returns an empty array', async () => {
      colGetMock.mockResolvedValue({ docs: [] });

      const result = await listProductsByCategory('nonexistent');

      expect(result.items).toEqual([]);
    });
  });
});

// ── new cannabis profile fields (#111) ────────────────────────────────────

describe('getProductBySlug — cannabis profile fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a product with all new profile fields present', () => {
    it('maps strain, effects, and flavors', async () => {
      docGetMock.mockResolvedValue(
        makeDocSnapshot('blue-dream', {
          slug: 'blue-dream',
          name: 'Blue Dream',
          strain: 'sativa',
          effects: ['Euphoria', 'Relaxed'],
          flavors: ['Citrus', 'Pine'],
          createdAt: new Date('2024-01-01').toISOString(),
          updatedAt: new Date('2024-06-01').toISOString(),
        })
      );

      const result = await getProductBySlug('blue-dream');

      expect(result).not.toBeNull();
      expect(result!.strain).toBe('sativa');
      expect(result!.effects).toEqual(['Euphoria', 'Relaxed']);
      expect(result!.flavors).toEqual(['Citrus', 'Pine']);
    });
  });

  describe('given a product with no new profile fields (legacy product)', () => {
    it('returns undefined for all new optional fields without error', async () => {
      docGetMock.mockResolvedValue(
        makeDocSnapshot('blue-dream', {
          slug: 'blue-dream',
          name: 'Blue Dream',
          category: 'flower',
          description: 'Classic',
          details: 'Smooth',
          status: 'active',
          availableAt: [],
          createdAt: new Date('2024-01-01').toISOString(),
          updatedAt: new Date('2024-06-01').toISOString(),
        })
      );

      const result = await getProductBySlug('blue-dream');

      expect(result).not.toBeNull();
      expect(result!.strain).toBeUndefined();
      expect(result!.effects).toBeUndefined();
      expect(result!.flavors).toBeUndefined();
    });
  });

  describe('given a product with an invalid strain value', () => {
    it('maps strain to undefined when value is not a valid ProductStrain', async () => {
      docGetMock.mockResolvedValue(
        makeDocSnapshot('blue-dream', {
          slug: 'blue-dream',
          name: 'Blue Dream',
          strain: 'unknown-type', // invalid
          createdAt: new Date('2024-01-01').toISOString(),
          updatedAt: new Date('2024-06-01').toISOString(),
        })
      );

      const result = await getProductBySlug('blue-dream');

      expect(result!.strain).toBeUndefined();
    });
  });
});

describe('listProducts — strain field on ProductSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given an active product with a strain', () => {
    it('includes strain on the returned summary', async () => {
      colGetMock.mockResolvedValue({
        docs: [
          makeDocSnapshot('blue-dream', {
            slug: 'blue-dream',
            name: 'Blue Dream',
            category: 'flower',
            description: 'Classic',
            status: 'active',
            strain: 'sativa',
            availableAt: [],
          }),
        ],
      });

      const result = await listProducts();

      expect(result.items).toHaveLength(1);
      expect(result.items[0].strain).toBe('sativa');
    });
  });

  describe('given an active product without a strain', () => {
    it('returns undefined for strain on the summary', async () => {
      colGetMock.mockResolvedValue({
        docs: [
          makeDocSnapshot('blue-dream', {
            slug: 'blue-dream',
            name: 'Blue Dream',
            category: 'flower',
            description: 'Classic',
            status: 'active',
            availableAt: [],
          }),
        ],
      });

      const result = await listProducts();

      expect(result.items[0].strain).toBeUndefined();
    });
  });
});

// ── getRelatedProducts ─────────────────────────────────────────────────────

describe('getRelatedProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given no products in the category', () => {
    it('returns an empty array', async () => {
      colGetMock.mockResolvedValue({ docs: [] });

      const result = await getRelatedProducts('blue-dream', 'flower');

      expect(result).toEqual([]);
    });
  });

  describe('given products in the same category including the excluded slug', () => {
    it('filters out the excludeSlug and returns the rest up to limit', async () => {
      colGetMock.mockResolvedValue({
        docs: [
          makeDocSnapshot('blue-dream', {
            slug: 'blue-dream',
            name: 'Blue Dream',
            category: 'flower',
            status: 'active',
            availableAt: [],
          }),
          makeDocSnapshot('og-kush', {
            slug: 'og-kush',
            name: 'OG Kush',
            category: 'flower',
            status: 'active',
            availableAt: [],
          }),
        ],
      });

      const result = await getRelatedProducts('blue-dream', 'flower', 6);

      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('og-kush');
    });
  });

  describe('given more products than the limit', () => {
    it('returns at most limit items (excluding the current slug)', async () => {
      const docs = Array.from({ length: 8 }, (_, i) =>
        makeDocSnapshot(`product-${i}`, {
          slug: `product-${i}`,
          name: `Product ${i}`,
          category: 'flower',
          status: 'active',
          availableAt: [],
        })
      );
      colGetMock.mockResolvedValue({ docs });

      const result = await getRelatedProducts('product-0', 'flower', 6);

      // product-0 excluded, leaving 7; capped at limit 6
      expect(result).toHaveLength(6);
      expect(result.every(p => p.slug !== 'product-0')).toBe(true);
    });
  });
});

// ── recomputeProductIndexes (pure) ─────────────────────────────────────────

describe('recomputeProductIndexes', () => {
  describe('given a unified variants map', () => {
    it('returns sorted location ids where qty - reserved > 0', () => {
      const result = recomputeProductIndexes({
        default: {
          label: 'Default',
          locations: {
            online: { qty: 5, price: 1500 },
            'oak-ridge': {
              qty: 3,
              price: 1500,
              availablePickup: true,
              featured: true,
            },
            seymour: { qty: 0, price: 1500 },
          },
        },
      });
      expect(result.inStockAt).toEqual(['oak-ridge', 'online']);
      expect(result.pickupAt).toEqual(['oak-ridge']);
      expect(result.featuredAt).toEqual(['oak-ridge']);
    });
  });

  describe('given a SKU whose available stock is fully reserved', () => {
    it('excludes that location from every index', () => {
      const result = recomputeProductIndexes({
        default: {
          label: 'Default',
          locations: {
            online: {
              qty: 2,
              reserved: 2,
              price: 1500,
              availablePickup: true,
              featured: true,
            },
          },
        },
      });
      expect(result.inStockAt).toEqual([]);
      expect(result.pickupAt).toEqual([]);
      expect(result.featuredAt).toEqual([]);
    });
  });

  describe('given undefined variants', () => {
    it('returns empty arrays', () => {
      expect(recomputeProductIndexes(undefined)).toEqual({
        inStockAt: [],
        pickupAt: [],
        featuredAt: [],
      });
    });
  });
});

// ── Self-pruning matrix (#399 final) ───────────────────────────────────────
//
// Every mutation method (setVariantLocation / decrementVariantStock /
// holdStock / releaseStock / commitStock) must:
//   1. Project any pre-unification array-shaped `variants` onto the
//      unified `variants` map BEFORE applying the mutation.
//   2. Write the unified map back as `variants`.
//
// `variantGroups` is NOT pruned — per Path A (#399) it is the stable
// option-dimension authoring source.
//
// We exercise the matrix through `setVariantLocation` because it's the
// simplest single-product mutation; the projection helper is shared across
// all six methods so coverage transfers.

function txProductSnap(
  slug: string,
  data: Record<string, unknown>
): {
  id: string;
  exists: boolean;
  data: () => Record<string, unknown>;
} {
  return {
    id: slug,
    exists: true,
    data: () => ({
      slug,
      name: 'Test',
      category: 'flower',
      details: '',
      status: 'active',
      availableAt: [],
      ...data,
    }),
  };
}

interface SelfPruningPayload {
  variants?: Record<
    string,
    { label: string; locations: Record<string, Record<string, unknown>> }
  >;
  variantGroups?: unknown;
  inStockAt?: string[];
  [k: string]: unknown;
}

describe('self-pruning write contract (#396)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a doc whose variants live only on variantGroups (no map data)', () => {
    it('projects the groups onto the unified variants map and leaves variantGroups intact', async () => {
      txGetMock.mockResolvedValueOnce(
        txProductSnap('grouped-only', {
          variantGroups: [
            {
              groupId: 'size',
              label: 'Size',
              combinable: false,
              options: [
                { optionId: 'eighth', label: '3.5g' },
                { optionId: 'quarter', label: '7g' },
              ],
            },
          ],
          // The eighth variant must exist in the projected map for
          // setVariantLocation to find it without bootstrapping.
        })
      );

      await setVariantLocation('grouped-only', 'eighth', 'oak-ridge', {
        qty: 4,
        price: 3000,
      });

      expect(txSetMock).toHaveBeenCalledTimes(1);
      const payload = txSetMock.mock.calls[0][1] as SelfPruningPayload;

      expect(payload.variants?.eighth.locations['oak-ridge']).toEqual({
        qty: 4,
        price: 3000,
      });
      // Path A (#399): variantGroups is the stable option-dimension
      // authoring source — never pruned by mutation writes.
      expect('variantGroups' in payload).toBe(false);
    });
  });

  describe('given a doc with neither legacy field present (canonical only)', () => {
    it('writes the unified map and does NOT emit FieldValue.delete sentinels for absent fields', async () => {
      txGetMock.mockResolvedValueOnce(
        txProductSnap('canonical-only', {
          variants: {
            default: {
              label: 'Default',
              locations: { online: { qty: 4, price: 1500 } },
            },
          },
        })
      );

      await setVariantLocation('canonical-only', 'default', 'online', {
        qty: 6,
        price: 1500,
      });

      const payload = txSetMock.mock.calls[0][1] as SelfPruningPayload;

      expect(payload.variants?.default.locations.online).toEqual({
        qty: 6,
        price: 1500,
      });
      // No legacy fields present → no delete sentinels emitted
      expect('variantGroups' in payload).toBe(false);
    });
  });
});

// ── Money path: reserved preservation across the unified map ──────────────

describe('money path — reserved preservation on the unified `variants` map', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('holdStock', () => {
    it('preserves an existing `reserved` count when holding more units', async () => {
      txGetMock.mockResolvedValueOnce(
        txProductSnap('held', {
          // Another in-flight session has 1 unit held.
          variants: {
            default: {
              label: 'Default',
              locations: { online: { qty: 5, reserved: 1, price: 1500 } },
            },
          },
        })
      );

      await holdStock([
        {
          productId: 'held',
          variantId: 'default',
          locationId: 'online',
          qty: 2,
        },
      ]);

      const payload = txSetMock.mock.calls[0][1] as SelfPruningPayload;
      // Existing reservation (1) plus new hold (2) = 3.
      expect(payload.variants?.default.locations.online.reserved).toBe(3);
      // qty unchanged on hold.
      expect(payload.variants?.default.locations.online.qty).toBe(5);
    });
  });

  describe('releaseStock', () => {
    it('decrements the `reserved` count', async () => {
      txGetMock.mockResolvedValueOnce(
        txProductSnap('released', {
          variants: {
            default: {
              label: 'Default',
              locations: { online: { qty: 5, reserved: 3, price: 1500 } },
            },
          },
        })
      );

      await releaseStock([
        {
          productId: 'released',
          variantId: 'default',
          locationId: 'online',
          qty: 2,
        },
      ]);

      const payload = txSetMock.mock.calls[0][1] as SelfPruningPayload;
      expect(payload.variants?.default.locations.online.reserved).toBe(1);
      expect(payload.variants?.default.locations.online.qty).toBe(5);
    });
  });

  describe('commitStock', () => {
    it('decrements both qty and reserved on the unified map', async () => {
      txGetMock.mockResolvedValueOnce(
        txProductSnap('committed', {
          variants: {
            default: {
              label: 'Default',
              locations: { online: { qty: 5, reserved: 2, price: 1500 } },
            },
          },
        })
      );

      await commitStock([
        {
          productId: 'committed',
          variantId: 'default',
          locationId: 'online',
          qty: 2,
        },
      ]);

      const payload = txSetMock.mock.calls[0][1] as SelfPruningPayload;
      expect(payload.variants?.default.locations.online.qty).toBe(3);
      expect(payload.variants?.default.locations.online.reserved).toBe(0);
    });
  });

  describe('decrementVariantStock', () => {
    it('preserves `reserved` when decrementing qty', async () => {
      txGetMock.mockResolvedValueOnce(
        txProductSnap('decremented', {
          variants: {
            default: {
              label: 'Default',
              locations: {
                'oak-ridge': { qty: 10, reserved: 4, price: 1500 },
              },
            },
          },
        })
      );

      await decrementVariantStock([
        {
          slug: 'decremented',
          variantId: 'default',
          locationId: 'oak-ridge',
          qty: 3,
        },
      ]);

      const payload = txSetMock.mock.calls[0][1] as SelfPruningPayload;
      // qty decremented, reserved untouched (decrement is independent of holds)
      expect(payload.variants?.default.locations['oak-ridge'].qty).toBe(7);
      expect(payload.variants?.default.locations['oak-ridge'].reserved).toBe(4);
    });
  });
});

// ── upsertProduct self-pruning matrix (#398) ──────────────────────────────
//
// The admin save path (createProduct / updateProduct server actions) writes
// through `upsertProduct`. After #398 step 3 the helper must self-prune
// legacy alias fields on the existing doc and write the unified `variants`
// map — preserving any per-location stock/price data already persisted on
// matching variantIds.

describe('upsertProduct self-pruning (admin save path) (#398)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function stubExistingDoc(data: Record<string, unknown>) {
    docGetMock.mockResolvedValueOnce({
      exists: true,
      data: () => data,
    });
  }

  function stubMissingDoc() {
    docGetMock.mockResolvedValueOnce({ exists: false, data: () => undefined });
  }

  describe('given a fresh doc (no existing variants — new product create)', () => {
    it('writes the unified variants map and recomputed indexes', async () => {
      stubMissingDoc();

      await upsertProduct({
        slug: 'fresh',
        name: 'Fresh',
        category: 'flower',
        details: '',
        availableAt: [],
        status: 'active',
        variants: {
          default: { label: 'Default', locations: {} },
        },
        inStockAt: [],
        pickupAt: [],
        featuredAt: [],
      });

      expect(docSetMock).toHaveBeenCalledTimes(1);
      const payload = docSetMock.mock.calls[0][0] as SelfPruningPayload;
      expect(payload.variants).toEqual({
        default: { label: 'Default', locations: {} },
      });
      expect(payload.inStockAt).toEqual([]);
    });
  });

  describe('given an existing doc whose variants live only on variantGroups', () => {
    it('seeds the supplied variants and leaves variantGroups untouched', async () => {
      stubExistingDoc({
        slug: 'grouped-only',
        name: 'Grouped',
        variantGroups: [
          {
            groupId: 'size',
            label: 'Size',
            combinable: false,
            options: [{ optionId: '1g', label: '1g' }],
          },
        ],
      });

      await upsertProduct({
        slug: 'grouped-only',
        name: 'Grouped',
        category: 'flower',
        details: '',
        availableAt: [],
        status: 'active',
        variants: { '1g': { label: '1g', locations: {} } },
      });

      const payload = docSetMock.mock.calls[0][0] as SelfPruningPayload;
      expect(payload.variants).toEqual({
        '1g': { label: '1g', locations: {} },
      });
      // variantGroups is the stable option-dimension authoring source
      // (Path A, #399). upsertProduct does not touch it.
      expect('variantGroups' in payload).toBe(false);
    });
  });

  describe('given an existing doc with per-location stock on the canonical map (editor reseeds with empty locations)', () => {
    it('preserves the per-location stock/price under the unified map', async () => {
      stubExistingDoc({
        slug: 'canonical-existing',
        variants: {
          default: {
            label: 'Default',
            locations: {
              'oak-ridge': { qty: 12, price: 4200, reserved: 2 },
            },
          },
        },
      });

      // Editor save: seeds the variant with empty locations — repo MUST
      // preserve the existing per-location data.
      await upsertProduct({
        slug: 'canonical-existing',
        name: 'Specs',
        category: 'flower',
        details: '',
        availableAt: [],
        status: 'active',
        variants: { default: { label: 'Default', locations: {} } },
      });

      const payload = docSetMock.mock.calls[0][0] as SelfPruningPayload;
      expect(payload.variants?.default.locations['oak-ridge']).toEqual({
        qty: 12,
        price: 4200,
        reserved: 2,
      });
      // Indexes recomputed from preserved data.
      expect(payload.inStockAt).toContain('oak-ridge');
    });
  });
});
