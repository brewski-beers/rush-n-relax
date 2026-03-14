export type UserRole =
  | 'owner'
  | 'storeOwner'
  | 'storeManager'
  | 'staff'
  | 'customer';

export type InvitableUserRole = Exclude<UserRole, 'owner'>;

export type PendingUserInviteStatus = 'pending' | 'accepted' | 'revoked';

export interface PendingUserInvite {
  id: string;
  email: string;
  role: InvitableUserRole;
  status: PendingUserInviteStatus;
  invitedByUid: string;
  invitedByEmail?: string;
  acceptedByUid?: string;
  createdAt: Date;
  updatedAt: Date;
  acceptedAt?: Date;
}
