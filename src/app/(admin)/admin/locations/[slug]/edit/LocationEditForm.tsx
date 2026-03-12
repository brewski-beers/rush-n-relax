'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { updateLocation } from './actions';
import type { Location } from '@/types';

interface Props {
  location: Location;
}

export function LocationEditForm({ location }: Props) {
  const boundAction = updateLocation.bind(null, location.slug);
  const [state, formAction, pending] = useActionState(boundAction, null);

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
        <input
          name="state"
          defaultValue={location.state}
          maxLength={2}
          required
        />
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
        <input name="hours" defaultValue={location.hours} required />
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
