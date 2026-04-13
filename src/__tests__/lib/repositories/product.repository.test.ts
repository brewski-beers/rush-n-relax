import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  docGetMock,
  docSetMock,
  docUpdateMock,
  colGetMock,
  collectionMock,
  getAdminFirestoreMock,
} = vi.hoisted(() => {
  const docGetMock = vi.fn();
  const docSetMock = vi.fn().mockResolvedValue(undefined);
  const docUpdateMock = vi.fn().mockResolvedValue(undefined);
  const colGetMock = vi.fn().mockResolvedValue({ docs: [] });

  const collectionMock = vi.fn(() => ({
    doc: vi.fn((id: string) => ({
      id,
      get: docGetMock,
      set: docSetMock,
      update: docUpdateMock,
    })),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    get: colGetMock,
  }));

  const getAdminFirestoreMock = vi.fn(() => ({
    collection: collectionMock,
  }));

  return {
    docGetMock,
    docSetMock,
    docUpdateMock,
    colGetMock,
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
  listProductsByIds,
  setProductStatus,
  upsertProduct,
  getProductBySlug,
  listProducts,
  listAllProducts,
  listProductsByCategory,
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
        federalDeadlineRisk: false,
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
        federalDeadlineRisk: false,
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
          federalDeadlineRisk: false,
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
      expect(result!.federalDeadlineRisk).toBe(false);
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

      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('blue-dream');
    });
  });

  describe('given no active products', () => {
    it('returns an empty array', async () => {
      colGetMock.mockResolvedValue({ docs: [] });

      const result = await listProducts();

      expect(result).toEqual([]);
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

      expect(result).toHaveLength(2);
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

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('flower');
    });
  });

  describe('given no products in the category', () => {
    it('returns an empty array', async () => {
      colGetMock.mockResolvedValue({ docs: [] });

      const result = await listProductsByCategory('nonexistent');

      expect(result).toEqual([]);
    });
  });
});

// ── new cannabis profile fields (#111) ────────────────────────────────────

describe('getProductBySlug — cannabis profile fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a product with all new profile fields present', () => {
    it('maps strain, effects, flavors, whatToExpect, and effectScores', async () => {
      docGetMock.mockResolvedValue(
        makeDocSnapshot('blue-dream', {
          slug: 'blue-dream',
          name: 'Blue Dream',
          strain: 'sativa',
          effects: ['Euphoria', 'Relaxed'],
          flavors: ['Citrus', 'Pine'],
          whatToExpect: ['Uplifting experience', 'Great for daytime use'],
          effectScores: {
            relaxation: 60,
            energy: 80,
            creativity: 90,
            euphoria: 75,
            focus: 70,
            painRelief: 40,
          },
          createdAt: new Date('2024-01-01').toISOString(),
          updatedAt: new Date('2024-06-01').toISOString(),
        })
      );

      const result = await getProductBySlug('blue-dream');

      expect(result).not.toBeNull();
      expect(result!.strain).toBe('sativa');
      expect(result!.effects).toEqual(['Euphoria', 'Relaxed']);
      expect(result!.flavors).toEqual(['Citrus', 'Pine']);
      expect(result!.whatToExpect).toEqual([
        'Uplifting experience',
        'Great for daytime use',
      ]);
      expect(result!.effectScores?.relaxation).toBe(60);
      expect(result!.effectScores?.energy).toBe(80);
      expect(result!.effectScores?.creativity).toBe(90);
      expect(result!.effectScores?.euphoria).toBe(75);
      expect(result!.effectScores?.focus).toBe(70);
      expect(result!.effectScores?.painRelief).toBe(40);
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
          federalDeadlineRisk: false,
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
      expect(result!.whatToExpect).toBeUndefined();
      expect(result!.effectScores).toBeUndefined();
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

  describe('given effectScores with all values absent', () => {
    it('returns undefined for effectScores when no numeric values present', async () => {
      docGetMock.mockResolvedValue(
        makeDocSnapshot('blue-dream', {
          slug: 'blue-dream',
          name: 'Blue Dream',
          effectScores: {}, // empty object — no numeric scores
          createdAt: new Date('2024-01-01').toISOString(),
          updatedAt: new Date('2024-06-01').toISOString(),
        })
      );

      const result = await getProductBySlug('blue-dream');

      expect(result!.effectScores).toBeUndefined();
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

      expect(result).toHaveLength(1);
      expect(result[0].strain).toBe('sativa');
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

      expect(result[0].strain).toBeUndefined();
    });
  });
});
