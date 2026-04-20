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
    <>
      {!vendor.isActive && (
        <p className="admin-warning-banner">
          This vendor is archived and hidden from the storefront. Use the
          Archive/Restore button on the{' '}
          <Link href="/admin/vendors">vendors list</Link> to change its status.
        </p>
      )}

      <form action={formAction} className="admin-form">
        {state?.error && <p className="admin-error">{state.error}</p>}

        <label>
          Slug{' '}
          <span className="admin-hint">(read-only — cannot be changed)</span>
          <input
            value={vendor.slug}
            disabled
            className="admin-input-readonly"
          />
        </label>

        <label>
          Name
          <input name="name" defaultValue={vendor.name} required />
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
          Logo URL <span className="admin-hint">(optional)</span>
          <input
            name="logoUrl"
            type="url"
            defaultValue={vendor.logoUrl ?? ''}
            placeholder="https://example.com/logo.png"
          />
        </label>

        <label>
          Description{' '}
          <span className="admin-hint">(optional — customer-facing copy)</span>
          <textarea
            name="description"
            rows={3}
            defaultValue={vendor.description ?? ''}
          />
        </label>

        <label>
          Categories{' '}
          <span className="admin-hint">
            Comma-separated (e.g. edibles, drinks, vapes)
          </span>
          <input
            name="categories"
            defaultValue={vendor.categories.join(', ')}
            placeholder="edibles, drinks"
          />
        </label>

        <div className="admin-form-actions">
          <Link href="/admin/vendors">Cancel</Link>
          <button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </>
  );
}
