'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { updateLocation } from './actions';
import type { Location } from '@/types';
import {
  parseHoursRange,
  STATE_OPTIONS,
  TIME_HOUR_OPTIONS,
  TIME_MERIDIEM_OPTIONS,
  TIME_MINUTE_OPTIONS,
} from '@/constants/locationFormOptions';

interface Props {
  location: Location;
}

export function LocationEditForm({ location }: Props) {
  const boundAction = updateLocation.bind(null, location.slug);
  const [state, formAction, pending] = useActionState(boundAction, null);
  const normalizedState = location.state.toUpperCase();
  const parsedHours = parseHoursRange(location.hours);
  const openHour = parsedHours?.openHour ?? '10';
  const openMinute = parsedHours?.openMinute ?? '00';
  const openMeridiem = parsedHours?.openMeridiem ?? 'AM';
  const closeHour = parsedHours?.closeHour ?? '10';
  const closeMinute = parsedHours?.closeMinute ?? '00';
  const closeMeridiem = parsedHours?.closeMeridiem ?? 'PM';

  return (
    <form action={formAction} className="admin-form">
      {state?.error && <p className="admin-error">{state.error}</p>}

      <label>
        Name
        <input name="name" defaultValue={location.name} required />
      </label>

      <label>
        Address
        <input name="address" defaultValue={location.address} required />
      </label>

      <label>
        City
        <input name="city" defaultValue={location.city} required />
      </label>

      <label>
        State
        <select name="state" defaultValue={normalizedState} required>
          {!STATE_OPTIONS.includes(
            normalizedState as (typeof STATE_OPTIONS)[number]
          ) ? (
            <option value={normalizedState}>{normalizedState}</option>
          ) : null}
          {STATE_OPTIONS.map(state => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </label>

      <label>
        ZIP
        <input name="zip" defaultValue={location.zip} required />
      </label>

      <label>
        Phone
        <input name="phone" defaultValue={location.phone} required />
      </label>

      <label>
        Hours
        <div className="admin-time-group">
          <div>
            <span className="admin-hint">Open</span>
            <div className="admin-time-segment">
              <select name="openHour" defaultValue={openHour} required>
                {TIME_HOUR_OPTIONS.map(hour => (
                  <option key={hour} value={hour}>
                    {hour}
                  </option>
                ))}
              </select>
              <span className="admin-time-colon">:</span>
              <select name="openMinute" defaultValue={openMinute} required>
                {TIME_MINUTE_OPTIONS.map(minute => (
                  <option key={minute} value={minute}>
                    {minute}
                  </option>
                ))}
              </select>
              <span className="admin-time-divider" />
              <select name="openMeridiem" defaultValue={openMeridiem} required>
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
              <select name="closeHour" defaultValue={closeHour} required>
                {TIME_HOUR_OPTIONS.map(hour => (
                  <option key={hour} value={hour}>
                    {hour}
                  </option>
                ))}
              </select>
              <span className="admin-time-colon">:</span>
              <select name="closeMinute" defaultValue={closeMinute} required>
                {TIME_MINUTE_OPTIONS.map(minute => (
                  <option key={minute} value={minute}>
                    {minute}
                  </option>
                ))}
              </select>
              <span className="admin-time-divider" />
              <select
                name="closeMeridiem"
                defaultValue={closeMeridiem}
                required
              >
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
        Google Place ID{' '}
        <span className="admin-hint">
          (optional but recommended for Google Search/Places/Maps integration)
        </span>
        <input
          name="placeId"
          defaultValue={location.placeId ?? ''}
          placeholder="ChIJ..."
        />
      </label>

      <label>
        Description
        <textarea
          name="description"
          defaultValue={location.description}
          rows={4}
          required
        />
      </label>

      <div className="admin-form-actions">
        <Link href="/admin/locations">Cancel</Link>
        <button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
