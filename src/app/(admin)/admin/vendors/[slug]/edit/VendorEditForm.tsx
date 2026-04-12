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
        Slug <span className="admin-hint">(cannot be changed)</span>
        <input
          value={vendor.slug}
          disabled
          className="admin-input-readonly"
          readOnly
        />
      </label>

      <label>
        Name
        <input name="name" defaultValue={vendor.name} required />
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
        Website <span className="admin-hint">(optional)</span>
        <input
          name="website"
          type="url"
          defaultValue={vendor.website ?? ''}
          placeholder="https://example.com"
        />
      </label>

      <label>
        Notes <span className="admin-hint">(optional — internal only)</span>
        <textarea name="notes" rows={2} defaultValue={vendor.notes ?? ''} />
      </label>

      <label className="admin-checkbox">
        <input
          type="checkbox"
          name="isActive"
          value="true"
          defaultChecked={vendor.isActive}
        />
        Active{' '}
        <span className="admin-hint">
          (inactive vendors are hidden from product forms)
        </span>
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
