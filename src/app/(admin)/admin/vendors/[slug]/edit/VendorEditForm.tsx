'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { updateVendor } from './actions';
import type { Vendor } from '@/types';

interface Props {
  vendor: Vendor;
}

export function VendorEditForm({ vendor }: Props) {
  const boundAction = updateVendor.bind(null, vendor.slug);
  const [state, formAction, pending] = useActionState(boundAction, null);

  return (
    <form action={formAction} className="admin-form">
      {state?.error && <p className="admin-error">{state.error}</p>}

      <label>
        Name
        <input name="name" defaultValue={vendor.name} required />
      </label>

      <label>
        Website
        <input
          name="website"
          type="url"
          defaultValue={vendor.website ?? ''}
          placeholder="https://example.com"
        />
      </label>

      <label>
        Logo URL
        <input
          name="logoUrl"
          type="url"
          defaultValue={vendor.logoUrl ?? ''}
          placeholder="https://example.com/logo.png"
        />
      </label>

      <label>
        Description Source
        <select
          name="descriptionSource"
          defaultValue={vendor.descriptionSource}
          required
        >
          <option value="leafly">Leafly</option>
          <option value="custom">Custom</option>
          <option value="vendor-provided">Vendor-Provided</option>
        </select>
      </label>

      <label>
        Notes
        <textarea name="notes" rows={3} defaultValue={vendor.notes ?? ''} />
      </label>

      <div className="admin-form-actions">
        <Link href="/admin/vendors">Cancel</Link>
        <button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
