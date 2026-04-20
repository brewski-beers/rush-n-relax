import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  docGetMock,
  docDeleteMock,
  docSetMock,
  colGetMock,
  collectionMock,
  getAdminFirestoreMock,
} = vi.hoisted(() => {
  const docGetMock = vi.fn();
  const docDeleteMock = vi.fn().mockResolvedValue(undefined);
  const docSetMock = vi.fn().mockResolvedValue(undefined);
  const colGetMock = vi.fn().mockResolvedValue({ docs: [] });

  const collectionMock = vi.fn(() => ({
    doc: vi.fn((id: string) => ({
      id,
      get: docGetMock,
      delete: docDeleteMock,
      set: docSetMock,
    })),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    startAfter: vi.fn().mockReturnThis(),
    get: colGetMock,
  }));

  const getAdminFirestoreMock = vi.fn(() => ({
    collection: collectionMock,
  }));

  return {
    docGetMock,
    docDeleteMock,
    docSetMock,
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
  listActivePromos,
  upsertPromo,
  deletePromo,
} from '@/lib/repositories/promo.repository';

// ── Helpers ────────────────────────────────────────────────────────────────

function makePromoDoc(
  id: string,
  data: Record<string, unknown>
): { id: string; data: () => Record<string, unknown> } {
  return { id, data: () => data };
}

// ── listActivePromos ───────────────────────────────────────────────────────
// Note: endDate filtering now happens in the Firestore query
// (`.where('endDate', '>', new Date())`), not in application code.
// Tests here validate the mapping + pagination shape.

describe('listActivePromos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given active promos returned by Firestore', () => {
    it('returns a PageResult with mapped PromoSummary items', async () => {
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
      colGetMock.mockResolvedValue({
        docs: [
          makePromoDoc('future-promo', {
            slug: 'future-promo',
            name: 'Future Promo',
            tagline: 'Coming soon',
            active: true,
            endDate: tomorrow,
          }),
        ],
      });

      const result = await listActivePromos();

      expect(result.items).toHaveLength(1);
      expect(result.items[0].slug).toBe('future-promo');
      expect(result.nextCursor).toBeNull();
    });
  });

  describe('given no active promos', () => {
    it('returns empty items array and null nextCursor', async () => {
      colGetMock.mockResolvedValue({ docs: [] });

      const result = await listActivePromos();

      expect(result.items).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });
  });

  describe('given a full page of results', () => {
    it('returns a non-null nextCursor equal to the last doc id', async () => {
      const docs = Array.from({ length: 25 }, (_, i) =>
        makePromoDoc(`promo-${i}`, {
          slug: `promo-${i}`,
          name: `Promo ${i}`,
          tagline: 'Test',
          active: true,
        })
      );
      colGetMock.mockResolvedValue({ docs });

      const result = await listActivePromos({ limit: 25 });

      expect(result.items).toHaveLength(25);
      expect(result.nextCursor).toBe('promo-24');
    });
  });
});

// ── upsertPromo ───────────────────────────────────────────────────────────

describe('upsertPromo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a valid promo payload', () => {
    it('calls set with merge: true on the correct doc and returns the slug', async () => {
      const result = await upsertPromo({
        slug: 'spring-sale',
        name: 'Spring Sale',
        tagline: 'Save big',
        description: 'Big discounts this spring',
        details: 'In-store only',
        cta: 'Shop Now',
        ctaPath: '/products',
        active: true,
      });

      expect(result).toBe('spring-sale');
      expect(docSetMock).toHaveBeenCalledOnce();
      const [payload, options] = docSetMock.mock.calls[0] as [
        Record<string, unknown>,
        Record<string, unknown>,
      ];
      expect(payload.slug).toBe('spring-sale');
      expect(payload.name).toBe('Spring Sale');
      expect(payload.updatedAt).toBeInstanceOf(Date);
      expect(options).toEqual({ merge: true });
    });
  });
});

// ── deletePromo ───────────────────────────────────────────────────────────

describe('deletePromo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a promo slug', () => {
    it('calls hard-delete on the correct document', async () => {
      await deletePromo('spring-sale');

      expect(docDeleteMock).toHaveBeenCalledOnce();
    });
  });
});
