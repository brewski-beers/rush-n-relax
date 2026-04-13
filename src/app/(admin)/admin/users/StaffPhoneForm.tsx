'use client';

import { useActionState } from 'react';
import {
  provisionStaffPhone,
  revokeStaffPhone,
  setStaffDisplayName,
} from './actions';

interface StaffPhoneUser {
  uid: string;
  phoneNumber: string;
  displayName: string;
}

interface Props {
  staffPhoneUsers: StaffPhoneUser[];
}

function maskPhone(phone: string): string {
  // E.164 format: +1XXXXXXXXXX → +1 (XXX) ***-**XX (show last 2 digits)
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return phone;
  const last2 = digits.slice(-2);
  const areaCode = digits.slice(-10, -7);
  return `+1 (${areaCode}) ***-**${last2}`;
}

function DisplayNameCell({ user }: { user: StaffPhoneUser }) {
  const [state, action, pending] = useActionState(setStaffDisplayName, null);

  return (
    <td>
      <form action={action} className="admin-inline-form">
        <input type="hidden" name="uid" value={user.uid} />
        <input
          name="displayName"
          type="text"
          defaultValue={user.displayName}
          placeholder="Add name…"
          className="admin-input admin-input--inline"
          disabled={pending}
          aria-label={`Display name for ${maskPhone(user.phoneNumber)}`}
        />
        <button
          type="submit"
          className="admin-btn admin-btn--sm"
          disabled={pending}
        >
          {pending ? '…' : 'Save'}
        </button>
        {state?.error && (
          <span className="admin-inline-error">{state.error}</span>
        )}
        {state?.success && (
          <span className="admin-inline-success">{state.success}</span>
        )}
      </form>
    </td>
  );
}

export function StaffPhoneForm({ staffPhoneUsers }: Props) {
  const [provisionState, provisionAction, provisionPending] = useActionState(
    provisionStaffPhone,
    null
  );
  const [revokeState, revokeAction, revokePending] = useActionState(
    revokeStaffPhone,
    null
  );

  return (
    <div className="admin-table-wrap">
      <h2 className="admin-section-title">Staff Phone Access</h2>
      <p className="admin-section-desc">
        Provision a staff role by US phone number. The user signs in via SMS OTP
        and receives the <strong>staff</strong> role.
      </p>

      <form action={provisionAction} className="admin-form">
        <div className="admin-form-row">
          <label htmlFor="phoneNumber" className="admin-label">
            Phone Number
          </label>
          <div className="admin-input-prefix-wrap">
            <span className="admin-input-prefix">+1</span>
            <input
              id="phoneNumber"
              name="phoneNumber"
              type="tel"
              placeholder="6155550123"
              className="admin-input"
              inputMode="numeric"
              maxLength={10}
              pattern="\d{10}"
              required
            />
          </div>
          <label htmlFor="displayName" className="admin-label">
            Name <span className="admin-label-optional">(optional)</span>
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            placeholder="e.g. Jamie"
            className="admin-input"
          />
          <button
            type="submit"
            className="admin-btn"
            disabled={provisionPending}
          >
            {provisionPending ? 'Provisioning…' : 'Provision Staff'}
          </button>
        </div>
        {provisionState?.error && (
          <p className="admin-error">{provisionState.error}</p>
        )}
        {provisionState?.success && (
          <p className="admin-success">{provisionState.success}</p>
        )}
      </form>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Phone (masked)</th>
            <th>Name</th>
            <th>UID</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {staffPhoneUsers.map(user => (
            <tr key={user.uid}>
              <td>{maskPhone(user.phoneNumber)}</td>
              <DisplayNameCell user={user} />
              <td>{user.uid}</td>
              <td>
                <form action={revokeAction}>
                  <input type="hidden" name="uid" value={user.uid} />
                  <button
                    type="submit"
                    className="admin-btn admin-btn--danger"
                    disabled={revokePending}
                  >
                    Revoke
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {staffPhoneUsers.length === 0 && (
            <tr>
              <td colSpan={4} className="admin-empty">
                No staff phone users provisioned.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {revokeState?.error && <p className="admin-error">{revokeState.error}</p>}
      {revokeState?.success && (
        <p className="admin-success">{revokeState.success}</p>
      )}
    </div>
  );
}
