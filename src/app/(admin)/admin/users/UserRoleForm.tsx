'use client';

import { useActionState } from 'react';
import { MANAGEABLE_ROLES } from '@/lib/admin/user-management';
import { assignUserRole } from './actions';

export function UserRoleForm() {
  const [state, formAction, pending] = useActionState(assignUserRole, null);

  return (
    <form
      action={formAction}
      className="admin-form"
      aria-label="User role assignment"
    >
      {state?.error ? <p className="admin-error">{state.error}</p> : null}
      {state?.success ? (
        <p className="admin-section-desc">{state.success}</p>
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
        <button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Assign Role'}
        </button>
      </div>
    </form>
  );
}
