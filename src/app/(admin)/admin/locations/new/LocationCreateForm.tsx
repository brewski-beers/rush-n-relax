'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createLocation } from './actions';

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
        <input name="state" placeholder="TN" maxLength={2} required />
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
        <input name="hours" placeholder="Mon-Sun: 10am - 10pm" required />
      </label>

      <label>
        Description
        <textarea name="description" rows={4} required />
      </label>

      <label>
        Google Place ID{' '}
        <span className="admin-hint">
          (from Google Maps — used for reviews)
        </span>
        <input name="placeId" placeholder="ChIJ..." required />
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
