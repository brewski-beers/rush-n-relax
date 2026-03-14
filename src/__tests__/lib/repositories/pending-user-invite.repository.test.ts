import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  setMock,
  orderByMock,
  getMock,
  docMock,
  collectionMock,
  getAdminFirestoreMock,
} = vi.hoisted(() => {
  const setMock = vi.fn().mockResolvedValue(undefined);

  const snapMock = (
    docs: { id: string; data: () => Record<string, unknown> }[]
  ) => ({
    docs,
  });

  const getMock = vi.fn().mockResolvedValue(snapMock([]));
  const limitMock = vi.fn().mockReturnThis();
  const orderByMock = vi
    .fn()
    .mockReturnValue({ get: getMock, limit: limitMock });

  const docMock = vi.fn((name?: string) => ({
    id: name ?? 'generated-id',
    set: setMock,
    get: vi
      .fn()
      .mockResolvedValue({
        exists: false,
        id: name ?? 'generated-id',
        data: () => ({}),
      }),
  }));

  const collectionMock = vi.fn(() => ({
    doc: docMock,
    orderBy: orderByMock,
  }));

  const getAdminFirestoreMock = vi.fn(() => ({
    collection: collectionMock,
  }));

  return {
    setMock,
    orderByMock,
    getMock,
    docMock,
    collectionMock,
    getAdminFirestoreMock,
  };
});

vi.mock('@/lib/firebase/admin', () => ({
  getAdminFirestore: getAdminFirestoreMock,
  toDate: (value: Date | string) => new Date(value),
}));

import {
  createOrUpdatePendingUserInvite,
  markPendingUserInviteAccepted,
  revokePendingUserInvite,
  listPendingUserInvites,
} from '@/lib/repositories/pending-user-invite.repository';

describe('pending-user-invite.repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createOrUpdatePendingUserInvite', () => {
    it('writes correct fields and returns the invite', async () => {
      const invite = await createOrUpdatePendingUserInvite({
        email: 'Staff@Example.com',
        role: 'staff',
        invitedByUid: 'uid-admin',
        invitedByEmail: 'admin@example.com',
      });

      expect(collectionMock).toHaveBeenCalledWith('pending-user-invites');
      expect(docMock).toHaveBeenCalledWith('staff@example.com');
      expect(setMock).toHaveBeenCalledTimes(1);

      const [payload, options] = setMock.mock.calls[0] as [
        Record<string, unknown>,
        Record<string, unknown>,
      ];

      expect(payload.email).toBe('staff@example.com');
      expect(payload.role).toBe('staff');
      expect(payload.status).toBe('pending');
      expect(payload.invitedByUid).toBe('uid-admin');
      expect(payload.invitedByEmail).toBe('admin@example.com');
      expect(payload.createdAt).toBeInstanceOf(Date);
      expect(payload.updatedAt).toBeInstanceOf(Date);
      expect(options).toEqual({ merge: true });

      expect(invite.email).toBe('staff@example.com');
      expect(invite.status).toBe('pending');
    });

    it('normalizes email to lowercase', async () => {
      await createOrUpdatePendingUserInvite({
        email: 'UPPER@EXAMPLE.COM',
        role: 'staff',
        invitedByUid: 'uid-admin',
      });

      expect(docMock).toHaveBeenCalledWith('upper@example.com');
    });
  });

  describe('markPendingUserInviteAccepted', () => {
    it('sets status to accepted with acceptedByUid and acceptedAt', async () => {
      await markPendingUserInviteAccepted({
        email: 'staff@example.com',
        acceptedByUid: 'uid-staff',
      });

      expect(setMock).toHaveBeenCalledTimes(1);

      const [payload, options] = setMock.mock.calls[0] as [
        Record<string, unknown>,
        Record<string, unknown>,
      ];

      expect(payload.status).toBe('accepted');
      expect(payload.acceptedByUid).toBe('uid-staff');
      expect(payload.acceptedAt).toBeInstanceOf(Date);
      expect(payload.updatedAt).toBeInstanceOf(Date);
      expect(options).toEqual({ merge: true });
    });
  });

  describe('revokePendingUserInvite', () => {
    it('sets status to revoked', async () => {
      await revokePendingUserInvite('staff@example.com');

      expect(setMock).toHaveBeenCalledTimes(1);

      const [payload, options] = setMock.mock.calls[0] as [
        Record<string, unknown>,
        Record<string, unknown>,
      ];

      expect(payload.status).toBe('revoked');
      expect(payload.updatedAt).toBeInstanceOf(Date);
      expect(options).toEqual({ merge: true });
    });
  });

  describe('listPendingUserInvites', () => {
    function makeDoc(email: string, status: string, now: Date) {
      return {
        id: email,
        data: () => ({
          email,
          role: 'staff',
          status,
          invitedByUid: 'uid-1',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        }),
      };
    }

    it('queries Firestore ordered by updatedAt descending', async () => {
      getMock.mockResolvedValueOnce({ docs: [] });

      await listPendingUserInvites();

      expect(collectionMock).toHaveBeenCalledWith('pending-user-invites');
      expect(orderByMock).toHaveBeenCalledWith('updatedAt', 'desc');
    });

    it('excludes non-pending invites from results', async () => {
      const now = new Date();
      getMock.mockResolvedValueOnce({
        docs: [
          makeDoc('a@example.com', 'pending', now),
          makeDoc('b@example.com', 'accepted', now),
          makeDoc('c@example.com', 'revoked', now),
        ],
      });

      const results = await listPendingUserInvites();

      expect(results).toHaveLength(1);
      expect(results[0].email).toBe('a@example.com');
      expect(results.every(r => r.status === 'pending')).toBe(true);
    });

    it('respects the limit when more pending invites exist than the cap', async () => {
      const now = new Date();
      getMock.mockResolvedValueOnce({
        docs: [
          makeDoc('a@example.com', 'pending', now),
          makeDoc('b@example.com', 'pending', now),
          makeDoc('c@example.com', 'pending', now),
        ],
      });

      const results = await listPendingUserInvites(2);

      expect(results).toHaveLength(2);
    });

    it('returns empty array when no invites exist', async () => {
      getMock.mockResolvedValueOnce({ docs: [] });

      const results = await listPendingUserInvites();

      expect(results).toEqual([]);
    });
  });
});
