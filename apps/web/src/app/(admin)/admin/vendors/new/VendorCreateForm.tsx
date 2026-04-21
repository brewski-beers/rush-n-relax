'use client';

import { useState, useActionState } from 'react';
import Link from 'next/link';
import { createVendor } from './actions';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function VendorCreateForm() {
  const [state, formAction, pending] = useActionState(createVendor, null);
  const [slug, setSlug] = useState('');

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSlug(toSlug(e.target.value));
  }

  return (
    <form action={formAction} className="admin-form">
      {state?.error && <p className="admin-error">{state.error}</p>}

      <label>
        Name
        <input name="name" required onChange={handleNameChange} />
      </label>

      <label>
        Slug{' '}
        <span className="admin-hint">
          (URL identifier — cannot be changed later)
        </span>
        <input
          name="slug"
          placeholder="e.g. enjoy"
          pattern="[a-z0-9-]+"
          required
          value={slug}
          onChange={e => setSlug(e.target.value.trim().toLowerCase())}
        />
      </label>

      <label>
        Website <span className="admin-hint">(optional)</span>
        <input name="website" type="url" placeholder="https://example.com" />
      </label>

      <label>
        Logo URL <span className="admin-hint">(optional)</span>
        <input
          name="logoUrl"
          type="url"
          placeholder="https://example.com/logo.png"
        />
      </label>

      <label>
        Description{' '}
        <span className="admin-hint">(optional — customer-facing copy)</span>
        <textarea name="description" rows={3} />
      </label>

      <label>
        Categories{' '}
        <span className="admin-hint">
          Comma-separated (e.g. edibles, drinks, vapes)
        </span>
        <input name="categories" placeholder="edibles, drinks" />
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
