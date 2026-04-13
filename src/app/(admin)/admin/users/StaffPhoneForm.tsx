'use client';

import { useActionState } from 'react';
import { provisionStaffPhone, revokeStaffPhone } from './actions';

interface StaffPhoneUser {
  uid: string;
  phoneNumber: string;
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
        Provision a staff role by phone number (E.164 format, e.g.{' '}
        <code>+16155550123</code>). The user signs in via SMS OTP and receives
        the <strong>staff</strong> role.
      </p>

      <form action={provisionAction} className="admin-form">
        <div className="admin-form-row">
          <label htmlFor="phoneNumber" className="admin-label">
            Phone Number (E.164)
          </label>
          <input
            id="phoneNumber"
            name="phoneNumber"
            type="tel"
            placeholder="+16155550123"
            className="admin-input"
            required
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
            <th>UID</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {staffPhoneUsers.map(user => (
            <tr key={user.uid}>
              <td>{maskPhone(user.phoneNumber)}</td>
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
              <td colSpan={3} className="admin-empty">
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
