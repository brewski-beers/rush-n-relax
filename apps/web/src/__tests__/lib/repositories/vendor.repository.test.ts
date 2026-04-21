import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  docGetMock,
  docSetMock,
  docUpdateMock,
  snapDocsMock,
  getAdminFirestoreMock,
} = vi.hoisted(() => {
  const docGetMock = vi.fn();
  const docSetMock = vi.fn().mockResolvedValue(undefined);
  const docUpdateMock = vi.fn().mockResolvedValue(undefined);
  const snapDocsMock = vi.fn();

  const makeDocRef = (id: string) => ({
    id,
    get: docGetMock,
    set: docSetMock,
    update: docUpdateMock,
  });

  const collectionMock = vi.fn(() => ({
    doc: vi.fn((id: string) => makeDocRef(id)),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    startAfter: vi.fn().mockReturnThis(),
    get: vi.fn(() => snapDocsMock() as unknown),
  }));

  const getAdminFirestoreMock = vi.fn(() => ({
    collection: collectionMock,
  }));

  return {
    docGetMock,
    docSetMock,
    docUpdateMock,
    snapDocsMock,
    getAdminFirestoreMock,
  };
});

vi.mock('@/lib/firebase/admin', () => ({
  getAdminFirestore: getAdminFirestoreMock,
  toDate: (v: unknown) => (v ? new Date(v as string) : new Date(0)),
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: () => 'SERVER_TIMESTAMP',
  },
}));

import {
  listVendors,
  listAllVendors,
  getVendorBySlug,
  upsertVendor,
  setVendorActive,
} from '@/lib/repositories/vendor.repository';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeVendorData(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'acme',
    name: 'Acme',
    categories: ['flower'],
    isActive: true,
    website: undefined,
    logoUrl: undefined,
    description: undefined,
    descriptionSource: undefined,
    notes: undefined,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeDocSnapshot(exists: boolean, data?: Record<string, unknown>) {
  return {
    exists,
    id: data?.slug ?? 'acme',
    data: () => (exists ? data : undefined),
  };
}

// ── listVendors ────────────────────────────────────────────────────────────

describe('listVendors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given active vendor documents in Firestore', () => {
    it('returns VendorSummary array mapped from documents', async () => {
      snapDocsMock.mockReturnValue({
        docs: [
          { id: 'acme', data: () => makeVendorData() },
          {
            id: 'beta',
            data: () => makeVendorData({ slug: 'beta', name: 'Beta' }),
          },
        ],
      });

      const { items: vendors } = await listVendors();
      expect(vendors).toHaveLength(2);
      expect(vendors[0].slug).toBe('acme');
      expect(vendors[1].name).toBe('Beta');
    });
  });

  describe('given no vendors', () => {
    it('returns an empty array', async () => {
      snapDocsMock.mockReturnValue({ docs: [] });
      const { items: vendors } = await listVendors();
      expect(vendors).toEqual([]);
    });
  });
});

// ── listAllVendors ─────────────────────────────────────────────────────────

describe('listAllVendors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given both active and inactive vendors', () => {
    it('returns all vendors regardless of isActive status', async () => {
      snapDocsMock.mockReturnValue({
        docs: [
          { id: 'acme', data: () => makeVendorData({ isActive: true }) },
          {
            id: 'retired',
            data: () =>
              makeVendorData({
                slug: 'retired',
                name: 'Retired',
                isActive: false,
              }),
          },
        ],
      });

      const { items: vendors } = await listAllVendors();
      expect(vendors).toHaveLength(2);
    });
  });
});

// ── getVendorBySlug ────────────────────────────────────────────────────────

describe('getVendorBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a slug that exists', () => {
    it('returns the Vendor object', async () => {
      docGetMock.mockResolvedValue(makeDocSnapshot(true, makeVendorData()));

      const vendor = await getVendorBySlug('acme');
      expect(vendor).not.toBeNull();
      expect(vendor?.slug).toBe('acme');
      expect(vendor?.name).toBe('Acme');
    });
  });

  describe('given a slug that does not exist', () => {
    it('returns null', async () => {
      docGetMock.mockResolvedValue(makeDocSnapshot(false));

      const vendor = await getVendorBySlug('ghost');
      expect(vendor).toBeNull();
    });
  });
});

// ── upsertVendor ───────────────────────────────────────────────────────────

describe('upsertVendor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a new vendor slug (does not exist)', () => {
    it('calls doc.set() with createdAt and updatedAt timestamps', async () => {
      docGetMock.mockResolvedValue(makeDocSnapshot(false));

      const slug = await upsertVendor({
        slug: 'new-vendor',
        name: 'New Vendor',
        categories: [],
        isActive: true,
      });

      expect(slug).toBe('new-vendor');
      expect(docSetMock).toHaveBeenCalledOnce();
      const [payload] = docSetMock.mock.calls[0] as [Record<string, unknown>];
      expect(payload.createdAt).toBe('SERVER_TIMESTAMP');
      expect(payload.updatedAt).toBe('SERVER_TIMESTAMP');
      expect(payload.name).toBe('New Vendor');
    });
  });

  describe('given an existing vendor slug', () => {
    it('calls doc.set() with merge: true and updatedAt but not createdAt', async () => {
      docGetMock.mockResolvedValue(makeDocSnapshot(true, makeVendorData()));

      await upsertVendor({
        slug: 'acme',
        name: 'Acme Updated',
        categories: ['concentrates'],
        isActive: true,
      });

      expect(docSetMock).toHaveBeenCalledOnce();
      const [payload, opts] = docSetMock.mock.calls[0] as [
        Record<string, unknown>,
        Record<string, unknown>,
      ];
      expect(payload.updatedAt).toBe('SERVER_TIMESTAMP');
      expect(payload.createdAt).toBeUndefined();
      expect(opts).toEqual({ merge: true });
    });
  });
});

// ── setVendorActive ────────────────────────────────────────────────────────

describe('setVendorActive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a vendor that exists', () => {
    it('calls docRef.update() with isActive and updatedAt', async () => {
      docGetMock.mockResolvedValue(makeDocSnapshot(true, makeVendorData()));

      await setVendorActive('acme', false);

      expect(docUpdateMock).toHaveBeenCalledWith({
        isActive: false,
        updatedAt: 'SERVER_TIMESTAMP',
      });
    });
  });

  describe('given a vendor that does not exist', () => {
    it('throws an error', async () => {
      docGetMock.mockResolvedValue(makeDocSnapshot(false));

      await expect(setVendorActive('ghost', true)).rejects.toThrow(
        "Vendor 'ghost' not found"
      );
    });
  });
});
