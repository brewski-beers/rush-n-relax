'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createPromo } from './actions';

export function PromoCreateForm() {
  const [state, formAction, pending] = useActionState(createPromo, null);

  return (
    <form action={formAction} className="admin-form">
      {state?.error && <p className="admin-error">{state.error}</p>}

      <label>
        Slug{' '}
        <span className="admin-hint">
          (URL identifier, e.g. laser-bong — cannot be changed later)
        </span>
        <input
          name="slug"
          placeholder="laser-bong"
          pattern="[a-z0-9-]+"
          required
        />
      </label>

      <label>
        Name
        <input name="name" required />
      </label>

      <label>
        Tagline
        <input name="tagline" required />
      </label>

      <label>
        Description
        <textarea name="description" rows={3} required />
      </label>

      <label>
        Details
        <textarea name="details" rows={5} required />
      </label>

      <label>
        CTA Label
        <input name="cta" placeholder="Visit Seymour" required />
      </label>

      <label>
        CTA Path
        <input name="ctaPath" placeholder="/locations/seymour" required />
      </label>

      <label>
        Location{' '}
        <span className="admin-hint">
          (optional — leave blank for all locations)
        </span>
        <input name="locationSlug" placeholder="seymour" />
      </label>

      <label>
        Active
        <select name="active" defaultValue="true">
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </label>

      <label>
        Start Date <span className="admin-hint">(optional)</span>
        <input name="startDate" type="date" />
      </label>

      <label>
        End Date{' '}
        <span className="admin-hint">
          (optional — promo auto-noindexed after this date)
        </span>
        <input name="endDate" type="date" />
      </label>

      <div className="admin-form-actions">
        <Link href="/admin/promos">Cancel</Link>
        <button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create Promo'}
        </button>
      </div>
    </form>
  );
}
