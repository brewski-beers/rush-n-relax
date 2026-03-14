import { cache } from 'react';
import { getAdminFirestore, toDate } from '@/lib/firebase/admin';
import type { InvitableUserRole, PendingUserInvite } from '@/types';

function pendingUserInvitesCol() {
  return getAdminFirestore().collection('pending-user-invites');
}

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const getPendingUserInviteByEmail = cache(
  async (email: string): Promise<PendingUserInvite | null> => {
    const normalizedEmail = normalizeInviteEmail(email);
    const doc = await pendingUserInvitesCol().doc(normalizedEmail).get();
    if (!doc.exists) {
      return null;
    }

    const invite = docToPendingUserInvite(doc.id, doc.data()!);
    return invite.status === 'pending' ? invite : null;
  }
);

export async function listPendingUserInvites(
  limit = 50
): Promise<PendingUserInvite[]> {
  const snap = await pendingUserInvitesCol().orderBy('updatedAt', 'desc').get();

  return snap.docs
    .map(doc => docToPendingUserInvite(doc.id, doc.data()))
    .filter(invite => invite.status === 'pending')
    .slice(0, limit);
}

export async function createOrUpdatePendingUserInvite(params: {
  email: string;
  role: InvitableUserRole;
  invitedByUid: string;
  invitedByEmail?: string;
}): Promise<PendingUserInvite> {
  const col = pendingUserInvitesCol();
  const email = normalizeInviteEmail(params.email);
  const now = new Date();

  const payload = stripUndefinedFields({
    email,
    role: params.role,
    status: 'pending' as const,
    invitedByUid: params.invitedByUid,
    invitedByEmail: params.invitedByEmail,
    createdAt: now,
    updatedAt: now,
    acceptedAt: undefined,
    acceptedByUid: undefined,
  });

  await col.doc(email).set(payload, { merge: true });

  return {
    id: email,
    email,
    role: params.role,
    status: 'pending',
    invitedByUid: params.invitedByUid,
    invitedByEmail: params.invitedByEmail,
    createdAt: now,
    updatedAt: now,
    acceptedAt: undefined,
    acceptedByUid: undefined,
  };
}

export async function markPendingUserInviteAccepted(params: {
  email: string;
  acceptedByUid: string;
}): Promise<void> {
  const email = normalizeInviteEmail(params.email);
  const now = new Date();
  await pendingUserInvitesCol().doc(email).set(
    {
      status: 'accepted',
      acceptedByUid: params.acceptedByUid,
      acceptedAt: now,
      updatedAt: now,
    },
    { merge: true }
  );
}

export async function revokePendingUserInvite(email: string): Promise<void> {
  const normalizedEmail = normalizeInviteEmail(email);
  const now = new Date();
  await pendingUserInvitesCol().doc(normalizedEmail).set(
    {
      status: 'revoked',
      updatedAt: now,
    },
    { merge: true }
  );
}

function docToPendingUserInvite(
  id: string,
  d: FirebaseFirestore.DocumentData
): PendingUserInvite {
  return {
    id,
    email: String(d.email ?? id),
    role: d.role,
    status: d.status ?? 'pending',
    invitedByUid: d.invitedByUid ?? '',
    invitedByEmail: d.invitedByEmail ?? undefined,
    acceptedByUid: d.acceptedByUid ?? undefined,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
    acceptedAt: d.acceptedAt ? toDate(d.acceptedAt) : undefined,
  } satisfies PendingUserInvite;
}

function stripUndefinedFields<T extends Record<string, unknown>>(
  value: T
): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}
