import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  docGetMock,
  docDeleteMock,
  docSetMock,
  colGetMock,
  whereMock,
  orderByMock,
  collectionMock,
  getAdminFirestoreMock,
} = vi.hoisted(() => {
  const docGetMock = vi.fn();
  const docDeleteMock = vi.fn().mockResolvedValue(undefined);
  const docSetMock = vi.fn().mockResolvedValue(undefined);
  const colGetMock = vi.fn();

  const orderByMock = vi.fn().mockReturnValue({
    get: colGetMock,
  });

  const whereMock = vi.fn().mockReturnValue({
    orderBy: orderByMock,
  });

  const collectionMock = vi.fn(() => ({
    doc: vi.fn((id: string) => ({
      id,
      get: docGetMock,
      delete: docDeleteMock,
      set: docSetMock,
    })),
    where: whereMock,
    orderBy: orderByMock,
  }));

  const getAdminFirestoreMock = vi.fn(() => ({
    collection: collectionMock,
  }));

  return {
    docGetMock,
    docDeleteMock,
    docSetMock,
    colGetMock,
    whereMock,
    orderByMock,
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

describe('listActivePromos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a promo whose endDate is in the past', () => {
    it('filters out the expired promo', async () => {
      const yesterday = new Date(Date.now() - 86_400_000).toISOString();
      colGetMock.mockResolvedValue({
        docs: [
          makePromoDoc('expired-sale', {
            slug: 'expired-sale',
            name: 'Expired Sale',
            tagline: 'Gone',
            active: true,
            endDate: yesterday,
          }),
        ],
      });

      const result = await listActivePromos();

      expect(result).toHaveLength(0);
    });
  });

  describe('given a promo with no endDate', () => {
    it('always includes the promo regardless of current date', async () => {
      colGetMock.mockResolvedValue({
        docs: [
          makePromoDoc('evergreen-promo', {
            slug: 'evergreen-promo',
            name: 'Evergreen Promo',
            tagline: 'Always on',
            active: true,
            // endDate intentionally absent
          }),
        ],
      });

      const result = await listActivePromos();

      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('evergreen-promo');
    });
  });

  describe('given a mix of expired and non-expired promos', () => {
    it('returns only the non-expired ones', async () => {
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
      const yesterday = new Date(Date.now() - 86_400_000).toISOString();

      colGetMock.mockResolvedValue({
        docs: [
          makePromoDoc('future-promo', {
            slug: 'future-promo',
            name: 'Future Promo',
            tagline: 'Coming soon',
            active: true,
            endDate: tomorrow,
          }),
          makePromoDoc('past-promo', {
            slug: 'past-promo',
            name: 'Past Promo',
            tagline: 'Over',
            active: true,
            endDate: yesterday,
          }),
        ],
      });

      const result = await listActivePromos();

      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('future-promo');
    });
  });

  describe('given no active promos', () => {
    it('returns an empty array', async () => {
      colGetMock.mockResolvedValue({ docs: [] });

      const result = await listActivePromos();

      expect(result).toEqual([]);
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
