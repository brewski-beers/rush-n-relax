import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  docGetMock,
  docSetMock,
  docUpdateMock,
  colGetMock,
  whereMock,
  orderByMock,
  collectionMock,
  getAdminFirestoreMock,
  serverTimestampMock,
} = vi.hoisted(() => {
  const docGetMock = vi.fn();
  const docSetMock = vi.fn().mockResolvedValue(undefined);
  const docUpdateMock = vi.fn().mockResolvedValue(undefined);
  const colGetMock = vi.fn().mockResolvedValue({ docs: [] });

  const limitMock = vi.fn().mockReturnValue({ get: colGetMock, startAfter: vi.fn().mockReturnValue({ get: colGetMock }) });
  const orderByMock = vi.fn().mockReturnValue({ limit: limitMock, get: colGetMock });
  const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock, where: vi.fn().mockReturnThis(), limit: limitMock });

  const collectionMock = vi.fn(() => ({
    doc: vi.fn((id: string) => ({
      id,
      get: docGetMock,
      set: docSetMock,
      update: docUpdateMock,
    })),
    where: whereMock,
    orderBy: orderByMock,
  }));

  const getAdminFirestoreMock = vi.fn(() => ({
    collection: collectionMock,
  }));

  // Sentinel value that represents a server timestamp
  const serverTimestampMock = Symbol('ServerTimestamp');

  return {
    docGetMock,
    docSetMock,
    docUpdateMock,
    colGetMock,
    whereMock,
    orderByMock,
    collectionMock,
    getAdminFirestoreMock,
    serverTimestampMock,
  };
});

vi.mock('@/lib/firebase/admin', () => ({
  getAdminFirestore: getAdminFirestoreMock,
  toDate: (value: Date | string | undefined) =>
    value ? new Date(value) : new Date(0),
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: () => serverTimestampMock,
  },
}));

import {
  upsertCategory,
  getCategoryBySlug,
  listActiveCategories,
  setCategoryStatus,
} from '@/lib/repositories/category.repository';

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

// ── upsertCategory ────────────────────────────────────────────────────────

describe('upsertCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a new (non-existent) document', () => {
    it('sets both createdAt and updatedAt on create', async () => {
      docGetMock.mockResolvedValue(makeDocSnapshot('new-cat', null));

      await upsertCategory({
        slug: 'new-cat',
        label: 'New Category',
        description: 'A brand new category',
        order: 1,
        isActive: true,
        requiresCannabisProfile: false,
        requiresNutritionFacts: false,
        requiresCOA: false,
      });

      expect(docSetMock).toHaveBeenCalledOnce();
      const [payload] = docSetMock.mock.calls[0] as [Record<string, unknown>];
      // Both timestamps must be present (server timestamp sentinels)
      expect(payload.createdAt).toBe(serverTimestampMock);
      expect(payload.updatedAt).toBe(serverTimestampMock);
    });

    it('returns the slug', async () => {
      docGetMock.mockResolvedValue(makeDocSnapshot('new-cat', null));

      const result = await upsertCategory({
        slug: 'new-cat',
        label: 'New Category',
        description: 'A brand new category',
        order: 1,
        isActive: true,
        requiresCannabisProfile: false,
        requiresNutritionFacts: false,
        requiresCOA: false,
      });

      expect(result).toBe('new-cat');
    });
  });

  describe('given an existing document', () => {
    it('sets only updatedAt on update (not createdAt)', async () => {
      docGetMock.mockResolvedValue(
        makeDocSnapshot('flower', {
          slug: 'flower',
          label: 'Flower',
          description: 'Old desc',
          order: 1,
          isActive: true,
        })
      );

      await upsertCategory({
        slug: 'flower',
        label: 'Flower Updated',
        description: 'New desc',
        order: 2,
        isActive: false,
        requiresCannabisProfile: false,
        requiresNutritionFacts: false,
        requiresCOA: false,
      });

      expect(docSetMock).toHaveBeenCalledOnce();
      const [payload, options] = docSetMock.mock.calls[0] as [
        Record<string, unknown>,
        Record<string, unknown>,
      ];
      // updatedAt should be set; createdAt must NOT be in payload
      expect(payload.updatedAt).toBe(serverTimestampMock);
      expect('createdAt' in payload).toBe(false);
      // Uses merge to avoid clobbering existing createdAt
      expect(options).toEqual({ merge: true });
    });
  });
});

// ── getCategoryBySlug ─────────────────────────────────────────────────────

describe('getCategoryBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a non-existent slug', () => {
    it('returns null', async () => {
      docGetMock.mockResolvedValue(makeDocSnapshot('ghost', null));

      const result = await getCategoryBySlug('ghost');

      expect(result).toBeNull();
    });
  });

  describe('given an existing slug', () => {
    it('returns the mapped category with the document ID as slug', async () => {
      docGetMock.mockResolvedValue(
        makeDocSnapshot('flower', {
          label: 'Flower',
          description: 'Great flower',
          order: 1,
          isActive: true,
          createdAt: new Date('2024-01-01').toISOString(),
          updatedAt: new Date('2024-06-01').toISOString(),
        })
      );

      const result = await getCategoryBySlug('flower');

      expect(result).not.toBeNull();
      expect(result!.slug).toBe('flower');
      expect(result!.label).toBe('Flower');
      expect(result!.order).toBe(1);
      expect(result!.isActive).toBe(true);
    });
  });
});

// ── listActiveCategories ──────────────────────────────────────────────────

describe('listActiveCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given active categories exist', () => {
    it('returns lightweight summaries with slug from doc.id', async () => {
      colGetMock.mockResolvedValue({
        docs: [
          { id: 'flower', data: () => ({ label: 'Flower', order: 1 }) },
          { id: 'edibles', data: () => ({ label: 'Edibles', order: 2 }) },
        ],
      });

      const result = await listActiveCategories();

      expect(result.items).toHaveLength(2);
      expect(result.items[0].slug).toBe('flower');
      expect(result.items[1].slug).toBe('edibles');
    });
  });

  describe('given no active categories', () => {
    it('returns an empty array', async () => {
      colGetMock.mockResolvedValue({ docs: [] });

      const result = await listActiveCategories();

      expect(result.items).toEqual([]);
    });
  });
});

// ── setCategoryStatus ─────────────────────────────────────────────────────

describe('setCategoryStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a slug and isActive = false', () => {
    it('calls update with isActive: false and a server timestamp', async () => {
      await setCategoryStatus('flower', false);

      expect(docUpdateMock).toHaveBeenCalledOnce();
      const [payload] = docUpdateMock.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(payload.isActive).toBe(false);
      expect(payload.updatedAt).toBe(serverTimestampMock);
    });
  });

  describe('given a slug and isActive = true', () => {
    it('calls update with isActive: true', async () => {
      await setCategoryStatus('flower', true);

      const [payload] = docUpdateMock.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(payload.isActive).toBe(true);
    });
  });
});
