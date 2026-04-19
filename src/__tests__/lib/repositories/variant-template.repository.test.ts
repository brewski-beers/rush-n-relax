import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { colAddMock, docSetMock, colWhereMock, getAdminFirestoreMock } =
  vi.hoisted(() => {
    const colAddMock = vi.fn();
    const docSetMock = vi.fn().mockResolvedValue(undefined);

    // The .where().limit().get() chain for checking existing docs
    const limitGetMock = vi.fn();
    const limitMock = vi.fn(() => ({ get: limitGetMock }));
    const colWhereMock = vi.fn(() => ({ limit: limitMock }));

    const collectionMock = vi.fn(() => ({
      add: colAddMock,
      where: colWhereMock,
      orderBy: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: [] }),
    }));

    const getAdminFirestoreMock = vi.fn(() => ({
      collection: collectionMock,
    }));

    return {
      colAddMock,
      docSetMock,
      colWhereMock,
      getAdminFirestoreMock,
    };
  });

vi.mock('@/lib/firebase/admin', () => ({
  getAdminFirestore: getAdminFirestoreMock,
  toDate: (value: Date | string | undefined) =>
    value ? new Date(value) : new Date(0),
}));

// We also need to mock FieldValue so serverTimestamp() returns something testable
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: () => 'SERVER_TIMESTAMP',
  },
}));

import { upsertVariantTemplate } from '@/lib/repositories/variant-template.repository';

// ── Helpers ────────────────────────────────────────────────────────────────

function getWhereChain() {
  // colWhereMock() → { limit: limitMock } → limitMock() → { get: limitGetMock }
  // We need access to the innermost get mock to set return values.
  // Re-read from the mock call chain each test.
  const whereResult = (colWhereMock as ReturnType<typeof vi.fn>).mock.results[0]
    ?.value as { limit: ReturnType<typeof vi.fn> } | undefined;
  return whereResult?.limit.mock.results[0]?.value as
    | { get: ReturnType<typeof vi.fn> }
    | undefined;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('upsertVariantTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('given a key that does NOT already exist in Firestore', () => {
    it('calls col.add() with createdAt and updatedAt, returns the new doc ID', async () => {
      // Arrange — query returns empty (no existing doc)
      const newDocRef = { id: 'new-generated-id' };
      colAddMock.mockResolvedValue(newDocRef);

      // Wire the where().limit().get() chain to return empty snapshot
      const limitGetMock = vi.fn().mockResolvedValue({ empty: true, docs: [] });
      const limitMock = vi.fn(() => ({ get: limitGetMock }));
      colWhereMock.mockReturnValue({ limit: limitMock });

      // Act
      const id = await upsertVariantTemplate({
        key: 'flower-weight',
        label: 'Flower (weight)',
        group: {
          groupId: 'g1',
          label: 'Weight',
          combinable: false,
          options: [] as [],
        },
      });

      // Assert
      expect(colAddMock).toHaveBeenCalledOnce();
      const [addPayload] = colAddMock.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(addPayload.key).toBe('flower-weight');
      expect(addPayload.label).toBe('Flower (weight)');
      expect(addPayload.createdAt).toBe('SERVER_TIMESTAMP');
      expect(addPayload.updatedAt).toBe('SERVER_TIMESTAMP');
      expect(id).toBe('new-generated-id');
    });
  });

  describe('given a key that ALREADY exists in Firestore', () => {
    it('calls docRef.set({ merge: true }) and NOT col.add()', async () => {
      // Arrange — query returns existing doc
      const existingDocRef = {
        id: 'existing-doc-id',
        set: docSetMock,
      };
      const limitGetMock = vi.fn().mockResolvedValue({
        empty: false,
        docs: [{ ref: existingDocRef }],
      });
      const limitMock = vi.fn(() => ({ get: limitGetMock }));
      colWhereMock.mockReturnValue({ limit: limitMock });

      // Act
      const id = await upsertVariantTemplate({
        key: 'flower-weight',
        label: 'Flower (weight) Updated',
        group: {
          groupId: 'g1',
          label: 'Weight',
          combinable: false,
          options: [] as [],
        },
      });

      // Assert
      expect(colAddMock).not.toHaveBeenCalled();
      expect(docSetMock).toHaveBeenCalledOnce();
      const [setPayload, setOptions] = docSetMock.mock.calls[0] as [
        Record<string, unknown>,
        Record<string, unknown>,
      ];
      expect(setPayload.label).toBe('Flower (weight) Updated');
      expect(setPayload.updatedAt).toBe('SERVER_TIMESTAMP');
      expect(setOptions).toEqual({ merge: true });
      expect(id).toBe('existing-doc-id');
    });
  });
});
