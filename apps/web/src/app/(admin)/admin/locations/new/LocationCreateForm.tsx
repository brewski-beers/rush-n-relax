'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createLocation } from './actions';
import {
  STATE_OPTIONS,
  TIME_HOUR_OPTIONS,
  TIME_MERIDIEM_OPTIONS,
  TIME_MINUTE_OPTIONS,
} from '@/constants/locationFormOptions';

export function LocationCreateForm() {
  const [state, formAction, pending] = useActionState(createLocation, null);

  return (
    <form action={formAction} className="admin-form">
      {state?.error && <p className="admin-error">{state.error}</p>}

      <label>
        Slug{' '}
        <span className="admin-hint">
          (URL identifier, e.g. oak-ridge — cannot be changed later)
        </span>
        <input
          name="slug"
          placeholder="oak-ridge"
          pattern="[a-z0-9-]+"
          onInput={event => {
            const target = event.currentTarget;
            target.value = target.value.toLowerCase();
          }}
          required
        />
      </label>

      <label>
        Name
        <input name="name" placeholder="Oak Ridge" required />
      </label>

      <label>
        Address
        <input name="address" placeholder="110 Bus Terminal Road" required />
      </label>

      <label>
        City
        <input name="city" placeholder="Oak Ridge" required />
      </label>

      <label>
        State
        <select name="state" defaultValue="TN" required>
          {STATE_OPTIONS.map(state => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </label>

      <label>
        ZIP
        <input name="zip" placeholder="37830" required />
      </label>

      <label>
        Phone
        <input name="phone" placeholder="+1 (865) 000-0000" required />
      </label>

      <label>
        Hours
        <div className="admin-time-group">
          <div>
            <span className="admin-hint">Open</span>
            <div className="admin-time-segment">
              <select name="openHour" defaultValue="10" required>
                {TIME_HOUR_OPTIONS.map(hour => (
                  <option key={hour} value={hour}>
                    {hour}
                  </option>
                ))}
              </select>
              <span className="admin-time-colon">:</span>
              <select name="openMinute" defaultValue="00" required>
                {TIME_MINUTE_OPTIONS.map(minute => (
                  <option key={minute} value={minute}>
                    {minute}
                  </option>
                ))}
              </select>
              <span className="admin-time-divider" />
              <select name="openMeridiem" defaultValue="AM" required>
                {TIME_MERIDIEM_OPTIONS.map(meridiem => (
                  <option key={meridiem} value={meridiem}>
                    {meridiem}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <span className="admin-hint">Close</span>
            <div className="admin-time-segment">
              <select name="closeHour" defaultValue="10" required>
                {TIME_HOUR_OPTIONS.map(hour => (
                  <option key={hour} value={hour}>
                    {hour}
                  </option>
                ))}
              </select>
              <span className="admin-time-colon">:</span>
              <select name="closeMinute" defaultValue="00" required>
                {TIME_MINUTE_OPTIONS.map(minute => (
                  <option key={minute} value={minute}>
                    {minute}
                  </option>
                ))}
              </select>
              <span className="admin-time-divider" />
              <select name="closeMeridiem" defaultValue="PM" required>
                {TIME_MERIDIEM_OPTIONS.map(meridiem => (
                  <option key={meridiem} value={meridiem}>
                    {meridiem}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </label>

      <label>
        Description
        <textarea name="description" rows={4} required />
      </label>

      <label>
        Google Place ID{' '}
        <span className="admin-hint">
          (optional but recommended for Google Search/Places/Maps integration)
        </span>
        <input name="placeId" placeholder="ChIJ..." />
      </label>

      <div className="admin-form-actions">
        <Link href="/admin/locations">Cancel</Link>
        <button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create Location'}
        </button>
      </div>
    </form>
  );
}
