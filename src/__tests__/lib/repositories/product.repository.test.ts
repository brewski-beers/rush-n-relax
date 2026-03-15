import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { docGetMock, docUpdateMock, collectionMock, getAdminFirestoreMock } =
  vi.hoisted(() => {
    const docGetMock = vi.fn();
    const docUpdateMock = vi.fn().mockResolvedValue(undefined);

    const collectionMock = vi.fn(() => ({
      doc: vi.fn((id: string) => ({
        id,
        get: docGetMock,
        update: docUpdateMock,
      })),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: [] }),
    }));

    const getAdminFirestoreMock = vi.fn(() => ({
      collection: collectionMock,
    }));

    return { docGetMock, docUpdateMock, collectionMock, getAdminFirestoreMock };
  });

vi.mock('@/lib/firebase/admin', () => ({
  getAdminFirestore: getAdminFirestoreMock,
  toDate: (value: Date | string | undefined) =>
    value ? new Date(value) : new Date(0),
}));

import {
  listProductsByIds,
  setProductStatus,
} from '@/lib/repositories/product.repository';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeDocSnapshot(
  id: string,
  data: Record<string, unknown> | null
): { id: string; exists: boolean; data: () => Record<string, unknown> | undefined } {
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

      docGetMock
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(missing);

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
    it("throws a descriptive error containing the slug", async () => {
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
