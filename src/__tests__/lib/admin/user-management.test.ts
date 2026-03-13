import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUserMock = vi.fn();
const getUserByEmailMock = vi.fn();
const listUsersMock = vi.fn();
const setCustomUserClaimsMock = vi.fn();

vi.mock('@/lib/firebase/admin', () => ({
  getAdminAuth: () => ({
    getUser: getUserMock,
    getUserByEmail: getUserByEmailMock,
    listUsers: listUsersMock,
    setCustomUserClaims: setCustomUserClaimsMock,
  }),
}));

import {
  assignNonOwnerRole,
  listManagedUsers,
} from '@/lib/admin/user-management';

describe('user-management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('assigns a non-owner role by email while preserving custom claims', async () => {
    getUserByEmailMock.mockResolvedValue({
      uid: 'staff-uid',
      customClaims: { team: 'east' },
    });

    await assignNonOwnerRole({
      uidOrEmail: 'STAFF@RUSHNRELAX.COM',
      role: 'storeManager',
    });

    expect(getUserByEmailMock).toHaveBeenCalledWith('staff@rushnrelax.com');
    expect(setCustomUserClaimsMock).toHaveBeenCalledWith('staff-uid', {
      team: 'east',
      role: 'storeManager',
    });
  });

  it('blocks owner accounts from modification', async () => {
    getUserMock.mockResolvedValue({
      uid: 'owner-uid',
      customClaims: { role: 'owner' },
    });

    await expect(
      assignNonOwnerRole({ uidOrEmail: 'owner-uid', role: 'staff' })
    ).rejects.toThrow('Owner accounts cannot be modified from this panel.');

    expect(setCustomUserClaimsMock).not.toHaveBeenCalled();
  });

  it('lists only non-owner managed users', async () => {
    listUsersMock.mockResolvedValue({
      users: [
        {
          uid: 'owner-uid',
          email: 'owner@rushnrelax.com',
          displayName: 'Owner',
          customClaims: { role: 'owner' },
        },
        {
          uid: 'mgr-uid',
          email: 'manager@rushnrelax.com',
          displayName: 'Manager',
          customClaims: { role: 'storeManager' },
        },
        {
          uid: 'staff-uid',
          email: 'staff@rushnrelax.com',
          displayName: null,
          customClaims: { role: 'staff' },
        },
      ],
      pageToken: undefined,
    });

    const users = await listManagedUsers();

    expect(users).toEqual([
      {
        uid: 'mgr-uid',
        email: 'manager@rushnrelax.com',
        displayName: 'Manager',
        role: 'storeManager',
      },
      {
        uid: 'staff-uid',
        email: 'staff@rushnrelax.com',
        displayName: '-',
        role: 'staff',
      },
    ]);
  });
});
