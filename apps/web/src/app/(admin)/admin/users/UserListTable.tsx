'use client';

import { useState, useActionState } from 'react';
import type { ManagedUserSummary } from '@/lib/admin/user-management';
import type { UserRole } from '@/types';
import { ConfirmButton } from '@/components/admin/ConfirmButton';
import { updateUserRole, addGoogleEmail } from './actions';

const ALL_ROLES: UserRole[] = [
  'owner',
  'storeOwner',
  'storeManager',
  'staff',
  'customer',
];

function providerLabel(id: string): string {
  if (id === 'google.com') return 'Google';
  if (id === 'phone') return 'Phone';
  if (id === 'password') return 'Email/Password';
  return id;
}

function hasGoogleProvider(providers: string[]): boolean {
  return providers.includes('google.com');
}

interface EditRowProps {
  user: ManagedUserSummary;
  onClose: () => void;
}

function EditRow({ user, onClose }: EditRowProps) {
  const [roleState, roleAction, rolePending] = useActionState(
    updateUserRole,
    null
  );
  const [emailState, emailAction, emailPending] = useActionState(
    addGoogleEmail,
    null
  );

  const defaultRole: UserRole =
    user.role === 'unassigned' ? 'customer' : user.role;
  const [selectedRole, setSelectedRole] = useState<UserRole>(defaultRole);

  const showGoogleEmailForm = !hasGoogleProvider(user.providers);
  const isOwnerPromotion = selectedRole === 'owner' && user.role !== 'owner';

  const confirmMessage = isOwnerPromotion
    ? `You are promoting ${user.email ?? user.uid} to OWNER. This grants full admin access. Type the user's email (${user.email ?? user.uid}) to confirm:`
    : `Change role for ${user.email ?? user.uid} to "${selectedRole}"?`;

  return (
    <tr className="admin-edit-row">
      <td colSpan={6}>
        <div className="admin-inline-edit-panel">
          <div className="admin-inline-edit-section">
            <strong>Role</strong>
            <form action={roleAction} className="admin-inline-form">
              <input type="hidden" name="uid" value={user.uid} />
              <select
                name="role"
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value as UserRole)}
                disabled={rolePending}
                className="admin-select admin-select--sm"
              >
                {ALL_ROLES.map(r => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <ConfirmButton
                type="submit"
                message={confirmMessage}
                confirmText={
                  isOwnerPromotion ? (user.email ?? user.uid) : undefined
                }
                className="admin-btn admin-btn--sm"
              >
                {rolePending ? '…' : 'Save Role'}
              </ConfirmButton>
            </form>
            {roleState?.error && (
              <span className="admin-inline-error">{roleState.error}</span>
            )}
            {roleState?.success && (
              <span className="admin-inline-success">{roleState.success}</span>
            )}
          </div>

          {showGoogleEmailForm && (
            <div className="admin-inline-edit-section">
              <strong>Link Google Identity</strong>
              <p className="admin-section-desc">
                Set the Google account email so this user can also sign in with
                Google.
              </p>
              <form action={emailAction} className="admin-inline-form">
                <input type="hidden" name="uid" value={user.uid} />
                <input
                  name="email"
                  type="email"
                  placeholder="user@gmail.com"
                  className="admin-input admin-input--inline"
                  disabled={emailPending}
                  aria-label="Google email to link"
                />
                <button
                  type="submit"
                  className="admin-btn admin-btn--sm"
                  disabled={emailPending}
                >
                  {emailPending ? '…' : 'Link Google'}
                </button>
              </form>
              {emailState?.error && (
                <span className="admin-inline-error">{emailState.error}</span>
              )}
              {emailState?.success && (
                <span className="admin-inline-success">
                  {emailState.success}
                </span>
              )}
            </div>
          )}

          <button
            type="button"
            className="admin-link-btn admin-link-btn--spaced"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </td>
    </tr>
  );
}

interface Props {
  users: ManagedUserSummary[];
}

export function UserListTable({ users }: Props) {
  const [editingUid, setEditingUid] = useState<string | null>(null);

  return (
    <div className="admin-table-wrap">
      <h2 className="admin-section-title">Firebase Auth Users</h2>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Display Name</th>
            <th>UID</th>
            <th>Providers</th>
            <th>Role</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <>
              <tr key={user.uid}>
                <td>{user.email}</td>
                <td>{user.displayName}</td>
                <td className="admin-uid-cell">{user.uid}</td>
                <td>
                  {user.providers.length > 0
                    ? user.providers.map(providerLabel).join(', ')
                    : '—'}
                </td>
                <td>{user.role}</td>
                <td>
                  <button
                    type="button"
                    className="admin-btn admin-btn--sm"
                    onClick={() =>
                      setEditingUid(prev =>
                        prev === user.uid ? null : user.uid
                      )
                    }
                  >
                    {editingUid === user.uid ? 'Cancel' : 'Edit'}
                  </button>
                </td>
              </tr>
              {editingUid === user.uid && (
                <EditRow
                  key={`edit-${user.uid}`}
                  user={user}
                  onClose={() => setEditingUid(null)}
                />
              )}
            </>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={6} className="admin-empty">
                No users found yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
