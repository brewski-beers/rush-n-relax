import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getAllMock, collectionMock, getAdminFirestoreMock } = vi.hoisted(() => {
  const getAllMock = vi.fn();
  const docMock = vi.fn((id: string) => ({ id }));
  const collectionMock = vi.fn(() => ({ doc: docMock }));
  const getAdminFirestoreMock = vi.fn(() => ({
    collection: collectionMock,
    getAll: getAllMock,
  }));
  return { getAllMock, collectionMock, getAdminFirestoreMock };
});

vi.mock('@/lib/firebase/admin', () => ({
  getAdminFirestore: getAdminFirestoreMock,
  toDate: (v: Date | string | undefined) => (v ? new Date(v) : new Date(0)),
  ONLINE_LOCATION_ID: 'online',
}));

import { getOnlineInStockSet } from '@/lib/repositories/inventory.repository';

function snap(id: string, data: Record<string, unknown> | null) {
  return data === null
    ? { id, exists: false, data: () => undefined }
    : { id, exists: true, data: () => data };
}

describe('getOnlineInStockSet', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the subset of ids that are inStock online', async () => {
    getAllMock.mockResolvedValueOnce([
      snap('a', { inStock: true }),
      snap('b', { inStock: false }),
      snap('c', { inStock: true }),
    ]);

    const result = await getOnlineInStockSet(['a', 'b', 'c']);

    expect(collectionMock).toHaveBeenCalledWith('inventory/online/items');
    expect(result).toEqual(new Set(['a', 'c']));
  });

  it('skips ids with no inventory doc', async () => {
    getAllMock.mockResolvedValueOnce([
      snap('a', { inStock: true }),
      snap('missing', null),
    ]);

    const result = await getOnlineInStockSet(['a', 'missing']);

    expect(result).toEqual(new Set(['a']));
  });

  it('short-circuits on empty input without hitting Firestore', async () => {
    const result = await getOnlineInStockSet([]);

    expect(getAllMock).not.toHaveBeenCalled();
    expect(result).toEqual(new Set());
  });
});
