import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  requireRoleMock,
  createOrUpdatePendingUserInviteMock,
  revokePendingUserInviteMock,
  assignNonOwnerRoleMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  createOrUpdatePendingUserInviteMock: vi.fn().mockResolvedValue(undefined),
  revokePendingUserInviteMock: vi.fn().mockResolvedValue(undefined),
  assignNonOwnerRoleMock: vi.fn().mockResolvedValue(undefined),
  revalidatePathMock: vi.fn(),
}));

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

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  inviteUser,
  assignUserRole,
  revokeInvite,
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
      const result = await inviteUser(
        null,
        makeFormData({ role: 'staff' })
      );

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
      const [inviteArg] = createOrUpdatePendingUserInviteMock.mock
        .calls[0] as [Record<string, unknown>];
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
