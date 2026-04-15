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

  it('lists all users including owner and unassigned', async () => {
    listUsersMock.mockResolvedValue({
      users: [
        {
          uid: 'owner-uid',
          email: 'owner@rushnrelax.com',
          displayName: 'Owner',
          customClaims: { role: 'owner' },
          providerData: [{ providerId: 'google.com' }],
          phoneNumber: undefined,
        },
        {
          uid: 'mgr-uid',
          email: 'manager@rushnrelax.com',
          displayName: 'Manager',
          customClaims: { role: 'storeManager' },
          providerData: [{ providerId: 'google.com' }],
          phoneNumber: undefined,
        },
        {
          uid: 'staff-uid',
          email: 'staff@rushnrelax.com',
          displayName: null,
          customClaims: { role: 'staff' },
          providerData: [{ providerId: 'phone' }],
          phoneNumber: '+16155550123',
        },
        {
          uid: 'new-user-uid',
          email: 'new@rushnrelax.com',
          displayName: 'New User',
          customClaims: undefined,
          providerData: [],
          phoneNumber: undefined,
        },
      ],
      pageToken: undefined,
    });

    const users = await listManagedUsers();

    expect(users).toEqual([
      {
        uid: 'owner-uid',
        email: 'owner@rushnrelax.com',
        displayName: 'Owner',
        role: 'owner',
        providers: ['google.com'],
        phoneNumber: undefined,
      },
      {
        uid: 'mgr-uid',
        email: 'manager@rushnrelax.com',
        displayName: 'Manager',
        role: 'storeManager',
        providers: ['google.com'],
        phoneNumber: undefined,
      },
      {
        uid: 'staff-uid',
        email: 'staff@rushnrelax.com',
        displayName: '-',
        role: 'staff',
        providers: ['phone'],
        phoneNumber: '+16155550123',
      },
      {
        uid: 'new-user-uid',
        email: 'new@rushnrelax.com',
        displayName: 'New User',
        role: 'unassigned',
        providers: [],
        phoneNumber: undefined,
      },
    ]);
  });
});
