import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  requireRoleMock,
  createOrUpdatePendingUserInviteMock,
  revokePendingUserInviteMock,
  assignNonOwnerRoleMock,
  revalidatePathMock,
  getUserMock,
  setCustomUserClaimsMock,
  updateUserMock,
  getUserByPhoneNumberMock,
  createUserMock,
  getAdminAuthMock,
} = vi.hoisted(() => {
  const getUserMock = vi.fn();
  const setCustomUserClaimsMock = vi.fn().mockResolvedValue(undefined);
  const updateUserMock = vi.fn().mockResolvedValue(undefined);
  const getUserByPhoneNumberMock = vi.fn();
  const createUserMock = vi.fn().mockResolvedValue({ uid: 'new-staff-uid' });

  const authInstance = {
    getUser: getUserMock,
    setCustomUserClaims: setCustomUserClaimsMock,
    updateUser: updateUserMock,
    getUserByPhoneNumber: getUserByPhoneNumberMock,
    createUser: createUserMock,
  };
  const getAdminAuthMock = vi.fn(() => authInstance);

  return {
    requireRoleMock: vi.fn(),
    createOrUpdatePendingUserInviteMock: vi.fn().mockResolvedValue(undefined),
    revokePendingUserInviteMock: vi.fn().mockResolvedValue(undefined),
    assignNonOwnerRoleMock: vi.fn().mockResolvedValue(undefined),
    revalidatePathMock: vi.fn(),
    getUserMock,
    setCustomUserClaimsMock,
    updateUserMock,
    getUserByPhoneNumberMock,
    createUserMock,
    getAdminAuthMock,
  };
});

vi.mock('@/lib/admin-auth', () => ({
  requireRole: requireRoleMock,
}));

vi.mock('@/lib/repositories', () => ({
  createOrUpdatePendingUserInvite: createOrUpdatePendingUserInviteMock,
  revokePendingUserInvite: revokePendingUserInviteMock,
}));

vi.mock('@/lib/admin/user-management', () => ({
  assignNonOwnerRole: assignNonOwnerRoleMock,
}));

vi.mock('@/lib/firebase/admin', () => ({
  getAdminAuth: getAdminAuthMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  inviteUser,
  assignUserRole,
  revokeInvite,
  updateUserRole,
  provisionStaffPhone,
  addGoogleEmail,
  revokeStaffPhone,
  setStaffDisplayName,
} from '@/app/(admin)/admin/users/actions';

// ── Helpers ────────────────────────────────────────────────────────────────

function stubAuthorisedActor() {
  requireRoleMock.mockResolvedValue({
    uid: 'owner-uid',
    email: 'owner@rushnrelax.com',
    role: 'owner',
  });
}

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  Object.entries(fields).forEach(([key, value]) => fd.append(key, value));
  return fd;
}

// ── inviteUser ─────────────────────────────────────────────────────────────

describe('inviteUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubAuthorisedActor();
  });

  describe('given missing email', () => {
    it('returns error: Email and role are required.', async () => {
      const result = await inviteUser(null, makeFormData({ role: 'staff' }));

      expect(result).toEqual({ error: 'Email and role are required.' });
      expect(createOrUpdatePendingUserInviteMock).not.toHaveBeenCalled();
    });
  });

  describe('given missing role', () => {
    it('returns error: Email and role are required.', async () => {
      const result = await inviteUser(
        null,
        makeFormData({ email: 'user@example.com' })
      );

      expect(result).toEqual({ error: 'Email and role are required.' });
      expect(createOrUpdatePendingUserInviteMock).not.toHaveBeenCalled();
    });
  });

  describe('given an invalid email address', () => {
    it('returns error: Enter a valid email address.', async () => {
      const result = await inviteUser(
        null,
        makeFormData({ email: 'not-an-email', role: 'staff' })
      );

      expect(result).toEqual({ error: 'Enter a valid email address.' });
      expect(createOrUpdatePendingUserInviteMock).not.toHaveBeenCalled();
    });
  });

  describe('given an invalid role', () => {
    it('returns error: Invalid role selected.', async () => {
      const result = await inviteUser(
        null,
        makeFormData({ email: 'user@example.com', role: 'superadmin' })
      );

      expect(result).toEqual({ error: 'Invalid role selected.' });
      expect(createOrUpdatePendingUserInviteMock).not.toHaveBeenCalled();
    });
  });

  describe('given owner role in the form (not invitable)', () => {
    it('returns error: Invalid role selected.', async () => {
      const result = await inviteUser(
        null,
        makeFormData({ email: 'owner2@example.com', role: 'owner' })
      );

      expect(result).toEqual({ error: 'Invalid role selected.' });
      expect(createOrUpdatePendingUserInviteMock).not.toHaveBeenCalled();
    });
  });

  describe('given valid email and role', () => {
    it('calls createOrUpdatePendingUserInvite and returns success', async () => {
      const result = await inviteUser(
        null,
        makeFormData({ email: 'NEW@EXAMPLE.COM', role: 'staff' })
      );

      expect(createOrUpdatePendingUserInviteMock).toHaveBeenCalledOnce();
      const [inviteArg] = createOrUpdatePendingUserInviteMock.mock.calls[0] as [
        Record<string, unknown>,
      ];
      // email should be lowercased
      expect(inviteArg.email).toBe('new@example.com');
      expect(inviteArg.role).toBe('staff');
      expect(inviteArg.invitedByUid).toBe('owner-uid');
      expect(inviteArg.invitedByEmail).toBe('owner@rushnrelax.com');
      expect(result.success).toContain('new@example.com');
    });
  });
});

// ── assignUserRole ─────────────────────────────────────────────────────────

describe('assignUserRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubAuthorisedActor();
  });

  describe('given missing uidOrEmail', () => {
    it('returns error: UID/email and role are required.', async () => {
      const result = await assignUserRole(
        null,
        makeFormData({ role: 'staff' })
      );

      expect(result).toEqual({ error: 'UID/email and role are required.' });
      expect(assignNonOwnerRoleMock).not.toHaveBeenCalled();
    });
  });

  describe('given an invalid role', () => {
    it('returns error: Invalid role selected.', async () => {
      const result = await assignUserRole(
        null,
        makeFormData({ uidOrEmail: 'staff@example.com', role: 'owner' })
      );

      expect(result).toEqual({ error: 'Invalid role selected.' });
      expect(assignNonOwnerRoleMock).not.toHaveBeenCalled();
    });
  });

  describe('given valid uidOrEmail and role', () => {
    it('calls assignNonOwnerRole and returns success', async () => {
      const result = await assignUserRole(
        null,
        makeFormData({ uidOrEmail: 'staff@example.com', role: 'storeManager' })
      );

      expect(assignNonOwnerRoleMock).toHaveBeenCalledOnce();
      expect(result.success).toContain('storeManager');
    });
  });

  describe('given assignNonOwnerRole throws', () => {
    it('returns the error message from the thrown Error', async () => {
      assignNonOwnerRoleMock.mockRejectedValue(
        new Error('Owner accounts cannot be modified from this panel.')
      );

      const result = await assignUserRole(
        null,
        makeFormData({ uidOrEmail: 'owner-uid', role: 'staff' })
      );

      expect(result).toEqual({
        error: 'Owner accounts cannot be modified from this panel.',
      });
    });
  });
});

// ── revokeInvite ───────────────────────────────────────────────────────────

describe('revokeInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubAuthorisedActor();
  });

  describe('given missing email', () => {
    it('returns error: Invite email is required.', async () => {
      const result = await revokeInvite(null, makeFormData({}));

      expect(result).toEqual({ error: 'Invite email is required.' });
      expect(revokePendingUserInviteMock).not.toHaveBeenCalled();
    });
  });

  describe('given a valid email', () => {
    it('calls revokePendingUserInvite and returns success', async () => {
      const result = await revokeInvite(
        null,
        makeFormData({ email: 'INVITED@EXAMPLE.COM' })
      );

      expect(revokePendingUserInviteMock).toHaveBeenCalledOnce();
      const [emailArg] = revokePendingUserInviteMock.mock.calls[0] as [string];
      // email is lowercased before passing to repository
      expect(emailArg).toBe('invited@example.com');
      expect(result.success).toContain('invited@example.com');
    });
  });
});

// ── updateUserRole ─────────────────────────────────────────────────────────

describe('updateUserRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubAuthorisedActor();
    getUserMock.mockResolvedValue({
      uid: 'target-uid',
      customClaims: { role: 'staff' },
    });
    setCustomUserClaimsMock.mockResolvedValue(undefined);
  });

  describe('given missing uid', () => {
    it('returns error: UID and role are required.', async () => {
      const result = await updateUserRole(
        null,
        makeFormData({ role: 'storeManager' })
      );
      expect(result).toEqual({ error: 'UID and role are required.' });
      expect(setCustomUserClaimsMock).not.toHaveBeenCalled();
    });
  });

  describe('given an invalid role', () => {
    it('returns error: Invalid role.', async () => {
      const result = await updateUserRole(
        null,
        makeFormData({ uid: 'target-uid', role: 'superadmin' })
      );
      expect(result).toEqual({ error: 'Invalid role.' });
      expect(setCustomUserClaimsMock).not.toHaveBeenCalled();
    });
  });

  describe('given valid uid and role', () => {
    it('calls auth.setCustomUserClaims with the new role and returns success', async () => {
      const result = await updateUserRole(
        null,
        makeFormData({ uid: 'target-uid', role: 'storeManager' })
      );

      expect(setCustomUserClaimsMock).toHaveBeenCalledWith('target-uid', {
        role: 'storeManager',
      });
      expect(result.success).toContain('storeManager');
    });
  });

  describe('given auth.getUser throws', () => {
    it('returns the error message', async () => {
      getUserMock.mockRejectedValue(new Error('User not found'));

      const result = await updateUserRole(
        null,
        makeFormData({ uid: 'missing-uid', role: 'staff' })
      );
      expect(result).toEqual({ error: 'User not found' });
    });
  });
});

// ── addGoogleEmail ─────────────────────────────────────────────────────────

describe('addGoogleEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubAuthorisedActor();
    updateUserMock.mockResolvedValue(undefined);
  });

  describe('given missing uid', () => {
    it('returns error: UID and email are required.', async () => {
      const result = await addGoogleEmail(
        null,
        makeFormData({ email: 'staff@example.com' })
      );
      expect(result).toEqual({ error: 'UID and email are required.' });
    });
  });

  describe('given an invalid email', () => {
    it('returns error: Enter a valid email address.', async () => {
      const result = await addGoogleEmail(
        null,
        makeFormData({ uid: 'some-uid', email: 'not-an-email' })
      );
      expect(result).toEqual({ error: 'Enter a valid email address.' });
      expect(updateUserMock).not.toHaveBeenCalled();
    });
  });

  describe('given valid uid and email', () => {
    it('calls auth.updateUser with email and emailVerified: true', async () => {
      const result = await addGoogleEmail(
        null,
        makeFormData({ uid: 'some-uid', email: 'STAFF@EXAMPLE.COM' })
      );

      expect(updateUserMock).toHaveBeenCalledWith('some-uid', {
        email: 'staff@example.com',
        emailVerified: true,
      });
      expect(result.success).toContain('staff@example.com');
    });
  });

  describe('given auth.updateUser throws', () => {
    it('returns the error message', async () => {
      updateUserMock.mockRejectedValue(new Error('EMAIL_EXISTS'));

      const result = await addGoogleEmail(
        null,
        makeFormData({ uid: 'some-uid', email: 'taken@example.com' })
      );
      expect(result).toEqual({ error: 'EMAIL_EXISTS' });
    });
  });
});

// ── provisionStaffPhone ────────────────────────────────────────────────────

describe('provisionStaffPhone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubAuthorisedActor();
  });

  describe('given missing phone number', () => {
    it('returns error: Phone number is required.', async () => {
      const result = await provisionStaffPhone(null, makeFormData({}));
      expect(result).toEqual({ error: 'Phone number is required.' });
    });
  });

  describe('given a phone number that is not 10 digits', () => {
    it('returns error about valid 10-digit US number', async () => {
      const result = await provisionStaffPhone(
        null,
        makeFormData({ phoneNumber: '12345' })
      );
      expect(result).toEqual({
        error: 'Enter a valid 10-digit US phone number (e.g. 6155550123).',
      });
    });
  });

  describe('given a phone number for an existing user', () => {
    it('updates claims to staff role and returns success', async () => {
      getUserByPhoneNumberMock.mockResolvedValue({
        uid: 'existing-uid',
        customClaims: { role: 'customer' },
      });
      setCustomUserClaimsMock.mockResolvedValue(undefined);

      const result = await provisionStaffPhone(
        null,
        makeFormData({ phoneNumber: '6155551234' })
      );

      expect(setCustomUserClaimsMock).toHaveBeenCalledWith('existing-uid', {
        role: 'staff',
      });
      expect(result.success).toContain('+16155551234');
    });
  });

  describe('given a phone number for a new user', () => {
    it('creates the user, sets staff claims, and returns success', async () => {
      const notFoundErr = Object.assign(new Error('Not found'), {
        code: 'auth/user-not-found',
      });
      getUserByPhoneNumberMock.mockRejectedValue(notFoundErr);
      createUserMock.mockResolvedValue({ uid: 'brand-new-uid' });
      setCustomUserClaimsMock.mockResolvedValue(undefined);

      const result = await provisionStaffPhone(
        null,
        makeFormData({ phoneNumber: '6155559999' })
      );

      expect(createUserMock).toHaveBeenCalledWith({
        phoneNumber: '+16155559999',
        displayName: undefined,
      });
      expect(setCustomUserClaimsMock).toHaveBeenCalledWith('brand-new-uid', {
        role: 'staff',
      });
      expect(result.success).toContain('+16155559999');
    });
  });
});

// ── revokeStaffPhone ───────────────────────────────────────────────────────

describe('revokeStaffPhone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubAuthorisedActor();
  });

  describe('given missing uid', () => {
    it('returns error: UID is required.', async () => {
      const result = await revokeStaffPhone(null, makeFormData({}));
      expect(result).toEqual({ error: 'UID is required.' });
    });
  });

  describe('given a valid uid', () => {
    it('demotes user to customer role and returns success', async () => {
      getUserMock.mockResolvedValue({
        uid: 'staff-uid',
        customClaims: { role: 'staff' },
      });
      setCustomUserClaimsMock.mockResolvedValue(undefined);

      const result = await revokeStaffPhone(
        null,
        makeFormData({ uid: 'staff-uid' })
      );

      expect(setCustomUserClaimsMock).toHaveBeenCalledWith('staff-uid', {
        role: 'customer',
      });
      expect(result.success).toContain('customer');
    });
  });

  describe('given auth throws', () => {
    it('returns the error message', async () => {
      getUserMock.mockRejectedValue(new Error('User not found'));

      const result = await revokeStaffPhone(
        null,
        makeFormData({ uid: 'ghost' })
      );
      expect(result).toEqual({ error: 'User not found' });
    });
  });
});

// ── setStaffDisplayName ────────────────────────────────────────────────────

describe('setStaffDisplayName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubAuthorisedActor();
    updateUserMock.mockResolvedValue(undefined);
  });

  describe('given missing uid', () => {
    it('returns error: UID is required.', async () => {
      const result = await setStaffDisplayName(
        null,
        makeFormData({ displayName: 'Alice' })
      );
      expect(result).toEqual({ error: 'UID is required.' });
    });
  });

  describe('given uid and a displayName', () => {
    it('calls auth.updateUser with the display name and returns success', async () => {
      const result = await setStaffDisplayName(
        null,
        makeFormData({ uid: 'staff-uid', displayName: 'Alice Smith' })
      );

      expect(updateUserMock).toHaveBeenCalledWith('staff-uid', {
        displayName: 'Alice Smith',
      });
      expect(result.success).toBe('Name updated.');
    });
  });

  describe('given uid with empty displayName', () => {
    it('calls auth.updateUser with null to clear the name', async () => {
      const result = await setStaffDisplayName(
        null,
        makeFormData({ uid: 'staff-uid', displayName: '' })
      );

      expect(updateUserMock).toHaveBeenCalledWith('staff-uid', {
        displayName: null,
      });
      expect(result.success).toBe('Name updated.');
    });
  });

  describe('given auth.updateUser throws', () => {
    it('returns the error message', async () => {
      updateUserMock.mockRejectedValue(new Error('auth/user-not-found'));

      const result = await setStaffDisplayName(
        null,
        makeFormData({ uid: 'ghost', displayName: 'Ghost' })
      );
      expect(result).toEqual({ error: 'auth/user-not-found' });
    });
  });
});
