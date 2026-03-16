import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  docGetMock,
  docSetMock,
  colGetMock,
  orderByMock,
  collectionMock,
  getAdminFirestoreMock,
} = vi.hoisted(() => {
  const docGetMock = vi.fn();
  const docSetMock = vi.fn().mockResolvedValue(undefined);
  const colGetMock = vi.fn().mockResolvedValue({ docs: [] });

  const orderByMock = vi.fn().mockReturnValue({ get: colGetMock });

  const collectionMock = vi.fn(() => ({
    doc: vi.fn((id: string) => ({
      id,
      get: docGetMock,
      set: docSetMock,
    })),
    orderBy: orderByMock,
  }));

  const getAdminFirestoreMock = vi.fn(() => ({
    collection: collectionMock,
  }));

  return {
    docGetMock,
    docSetMock,
    colGetMock,
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

// React cache is a no-op in unit tests — just pass the function through
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  };
});

import {
  listLocations,
  getLocationBySlug,
  upsertLocation,
} from '@/lib/repositories/location.repository';

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

function makeLocationData(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    slug: 'oak-ridge',
    name: 'Oak Ridge',
    address: '123 Oak Ave',
    city: 'Oak Ridge',
    state: 'TN',
    zip: '37830',
    phone: '865-555-0100',
    hours: '9:00 AM - 9:00 PM',
    description: 'Our Oak Ridge location',
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-06-01').toISOString(),
    ...overrides,
  };
}

// ── listLocations ─────────────────────────────────────────────────────────

describe('listLocations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given multiple locations', () => {
    it('returns lightweight summaries with slug from doc.id', async () => {
      colGetMock.mockResolvedValue({
        docs: [
          {
            id: 'maryville',
            data: () =>
              makeLocationData({ slug: 'maryville', name: 'Maryville' }),
          },
          {
            id: 'oak-ridge',
            data: () =>
              makeLocationData({ slug: 'oak-ridge', name: 'Oak Ridge' }),
          },
        ],
      });

      const result = await listLocations();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('maryville');
      expect(result[0].name).toBe('Maryville');
      expect(result[1].id).toBe('oak-ridge');
    });
  });

  describe('given no locations', () => {
    it('returns an empty array', async () => {
      colGetMock.mockResolvedValue({ docs: [] });

      const result = await listLocations();

      expect(result).toEqual([]);
    });
  });

  describe('given a doc where data() returns undefined', () => {
    it('skips the phantom snapshot', async () => {
      colGetMock.mockResolvedValue({
        docs: [
          { id: 'phantom', data: () => undefined },
          {
            id: 'real-location',
            data: () =>
              makeLocationData({
                slug: 'real-location',
                name: 'Real Location',
              }),
          },
        ],
      });

      const result = await listLocations();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('real-location');
    });
  });
});

// ── getLocationBySlug ─────────────────────────────────────────────────────

describe('getLocationBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a non-existent slug', () => {
    it('returns null', async () => {
      docGetMock.mockResolvedValue(makeDocSnapshot('ghost', null));

      const result = await getLocationBySlug('ghost');

      expect(result).toBeNull();
    });
  });

  describe('given an existing slug', () => {
    it('returns the full location with all fields mapped', async () => {
      docGetMock.mockResolvedValue(
        makeDocSnapshot('oak-ridge', makeLocationData())
      );

      const result = await getLocationBySlug('oak-ridge');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('oak-ridge');
      expect(result!.slug).toBe('oak-ridge');
      expect(result!.name).toBe('Oak Ridge');
      expect(result!.state).toBe('TN');
      expect(result!.description).toBe('Our Oak Ridge location');
    });

    it('defaults optional fields to undefined when absent', async () => {
      docGetMock.mockResolvedValue(
        makeDocSnapshot('oak-ridge', makeLocationData())
      );

      const result = await getLocationBySlug('oak-ridge');

      expect(result!.coordinates).toBeUndefined();
      expect(result!.socialLinkIds).toBeUndefined();
      expect(result!.cloverMerchantId).toBeUndefined();
      expect(result!.ogImagePath).toBeUndefined();
      expect(result!.seoDescription).toBeUndefined();
    });
  });
});

// ── upsertLocation ────────────────────────────────────────────────────────

describe('upsertLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a valid location payload', () => {
    it('calls set with merge: true on the correct doc and returns the slug', async () => {
      const result = await upsertLocation({
        slug: 'seymour',
        name: 'Seymour',
        address: '789 Seymour Rd',
        city: 'Seymour',
        state: 'TN',
        zip: '37865',
        phone: '865-555-0300',
        hours: '9:00 AM - 8:00 PM',
        description: 'Our Seymour location',
      });

      expect(result).toBe('seymour');
      expect(docSetMock).toHaveBeenCalledOnce();
      const [payload, options] = docSetMock.mock.calls[0] as [
        Record<string, unknown>,
        Record<string, unknown>,
      ];
      expect(payload.slug).toBe('seymour');
      expect(payload.name).toBe('Seymour');
      expect(payload.updatedAt).toBeInstanceOf(Date);
      expect(options).toEqual({ merge: true });
    });

    it('strips undefined optional fields from the payload', async () => {
      await upsertLocation({
        slug: 'seymour',
        name: 'Seymour',
        address: '789 Seymour Rd',
        city: 'Seymour',
        state: 'TN',
        zip: '37865',
        phone: '865-555-0300',
        hours: '9:00 AM - 8:00 PM',
        description: 'Our Seymour location',
        // coordinates intentionally absent
      });

      const [payload] = docSetMock.mock.calls[0] as [Record<string, unknown>];
      expect('coordinates' in payload).toBe(false);
    });
  });
});
