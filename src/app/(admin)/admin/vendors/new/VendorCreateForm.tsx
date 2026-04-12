'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createVendor } from './actions';

export function VendorCreateForm() {
  const [state, formAction, pending] = useActionState(createVendor, null);

  return (
    <form action={formAction} className="admin-form">
      {state?.error && <p className="admin-error">{state.error}</p>}

      <label>
        Slug{' '}
        <span className="admin-hint">
          (unique document ID, e.g. cbdistillery — cannot be changed later)
        </span>
        <input
          name="slug"
          placeholder="cbdistillery"
          pattern="[a-z0-9-]+"
          required
        />
      </label>

      <label>
        Name
        <input name="name" placeholder="CBDistillery" required />
      </label>

      <label>
        Description Source
        <select name="descriptionSource" required defaultValue="custom">
          <option value="leafly">Leafly</option>
          <option value="custom">Custom</option>
          <option value="vendor-provided">Vendor-Provided</option>
        </select>
      </label>

      <label>
        Website <span className="admin-hint">(optional)</span>
        <input name="website" type="url" placeholder="https://example.com" />
      </label>

      <label>
        Notes <span className="admin-hint">(optional — internal only)</span>
        <textarea name="notes" rows={2} />
      </label>

      <label className="admin-checkbox">
        <input type="checkbox" name="isActive" value="true" defaultChecked />
        Active{' '}
        <span className="admin-hint">
          (inactive vendors are hidden from product forms)
        </span>
      </label>

      <div className="admin-form-actions">
        <Link href="/admin/vendors">Cancel</Link>
        <button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create Vendor'}
        </button>
      </div>
    </form>
  );
}
