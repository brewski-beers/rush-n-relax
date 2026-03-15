'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createProduct } from './actions';
import type { LocationSummary } from '@/types';

interface Props {
  locations: LocationSummary[];
}

export function ProductCreateForm({ locations }: Props) {
  const [state, formAction, pending] = useActionState(createProduct, null);

  return (
    <form action={formAction} className="admin-form">
      {state?.error && <p className="admin-error">{state.error}</p>}

      <label>
        Slug{' '}
        <span className="admin-hint">
          (URL identifier, e.g. flower — cannot be changed later)
        </span>
        <input name="slug" placeholder="flower" pattern="[a-z0-9-]+" required />
      </label>

      <label>
        Name
        <input name="name" required />
      </label>

      <label>
        Category
        <select name="category" required>
          <option value="">Select…</option>
          <option value="flower">Flower</option>
          <option value="concentrates">Concentrates</option>
          <option value="drinks">Drinks</option>
          <option value="edibles">Edibles</option>
          <option value="vapes">Vapes</option>
        </select>
      </label>

      <label>
        Description
        <textarea name="description" rows={3} required />
      </label>

      <label>
        Details
        <textarea name="details" rows={5} required />
      </label>

      <fieldset className="admin-fieldset">
        <legend>Available At</legend>
        {locations.map(loc => (
          <label key={loc.slug} className="admin-checkbox">
            <input
              type="checkbox"
              name="availableAt"
              value={loc.slug}
              defaultChecked
            />
            {loc.name}
          </label>
        ))}
      </fieldset>

      <label className="admin-checkbox">
        <input type="checkbox" name="federalDeadlineRisk" value="true" />
        Federal deadline risk{' '}
        <span className="admin-hint">
          (≤0.4mg total THC — affected by Nov 2026 rule)
        </span>
      </label>

      <div className="admin-form-actions">
        <Link href="/admin/products">Cancel</Link>
        <button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create Product'}
        </button>
      </div>
    </form>
  );
}
