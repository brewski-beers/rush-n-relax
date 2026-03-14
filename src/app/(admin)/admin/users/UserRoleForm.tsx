'use client';

import { useActionState } from 'react';
import { MANAGEABLE_ROLES } from '@/lib/admin/roles';
import { assignUserRole, inviteUser } from './actions';

export function UserRoleForm() {
  const [inviteState, inviteAction, invitePending] = useActionState(
    inviteUser,
    null
  );
  const [assignState, assignAction, assignPending] = useActionState(
    assignUserRole,
    null
  );

  return (
    <div className="admin-form-stack">
      <form
        action={inviteAction}
        className="admin-form"
        aria-label="Invite user"
      >
        <h2 className="admin-section-title">Invite User</h2>
        <p className="admin-section-desc">
          Pre-assign a role by email. The role is applied when the user first
          signs in with Google.
        </p>

        {inviteState?.error ? (
          <p className="admin-error">{inviteState.error}</p>
        ) : null}
        {inviteState?.success ? (
          <p className="admin-section-desc">{inviteState.success}</p>
        ) : null}

        <label>
          Email
          <input
            name="email"
            type="email"
            placeholder="user@example.com"
            autoComplete="email"
            required
          />
        </label>

        <label>
          Role
          <select name="role" defaultValue="staff" required>
            {MANAGEABLE_ROLES.map(role => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>

        <div className="admin-form-actions">
          <button type="submit" disabled={invitePending}>
            {invitePending ? 'Saving…' : 'Save Invite'}
          </button>
        </div>
      </form>

      <form
        action={assignAction}
        className="admin-form"
        aria-label="Assign role to existing user"
      >
        <h2 className="admin-section-title">Assign Existing User Role</h2>
        <p className="admin-section-desc">
          Use this when the user already exists in Firebase Auth.
        </p>

        {assignState?.error ? (
          <p className="admin-error">{assignState.error}</p>
        ) : null}
        {assignState?.success ? (
          <p className="admin-section-desc">{assignState.success}</p>
        ) : null}

        <label>
          UID or Email
          <input
            name="uidOrEmail"
            placeholder="user uid or user@example.com"
            required
          />
        </label>

        <label>
          Role
          <select name="role" defaultValue="staff" required>
            {MANAGEABLE_ROLES.map(role => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>

        <div className="admin-form-actions">
          <button type="submit" disabled={assignPending}>
            {assignPending ? 'Saving…' : 'Assign Role'}
          </button>
        </div>
      </form>
    </div>
  );
}
