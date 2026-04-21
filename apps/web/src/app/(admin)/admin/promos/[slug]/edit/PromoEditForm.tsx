'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { updatePromo } from './actions';
import type { Promo } from '@/types';

interface Props {
  promo: Promo;
}

export function PromoEditForm({ promo }: Props) {
  const boundAction = updatePromo.bind(null, promo.slug);
  const [state, formAction, pending] = useActionState(boundAction, null);

  return (
    <form action={formAction} className="admin-form">
      {state?.error && <p className="admin-error">{state.error}</p>}

      <label>
        Name
        <input name="name" defaultValue={promo.name} required />
      </label>

      <label>
        Tagline
        <input name="tagline" defaultValue={promo.tagline} required />
      </label>

      <label>
        Description
        <textarea
          name="description"
          defaultValue={promo.description}
          rows={3}
          required
        />
      </label>

      <label>
        Details
        <textarea
          name="details"
          defaultValue={promo.details}
          rows={5}
          required
        />
      </label>

      <label>
        CTA Label
        <input name="cta" defaultValue={promo.cta} required />
      </label>

      <label>
        CTA Path
        <input name="ctaPath" defaultValue={promo.ctaPath} required />
      </label>

      <label>
        Location (slug, optional)
        <input
          name="locationSlug"
          defaultValue={promo.locationSlug ?? ''}
          placeholder="e.g. seymour"
        />
      </label>

      <label>
        Active
        <select name="active" defaultValue={String(promo.active)}>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </label>

      <div className="admin-form-actions">
        <Link href="/admin/promos">Cancel</Link>
        <button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
