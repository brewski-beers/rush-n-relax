'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import Link from 'next/link';
import { createProduct } from './actions';
import { ProductImageUpload } from '@/components/admin/ProductImageUpload';
import { CoaSelector } from '@/components/admin/CoaSelector';
import type { ProductCategorySummary } from '@/types';

interface Props {
  categories: ProductCategorySummary[];
}

export function ProductCreateForm({ categories }: Props) {
  const [state, formAction, pending] = useActionState(createProduct, null);
  const [slug, setSlug] = useState('');

  return (
    <form action={formAction} className="admin-form">
      {state?.error && <p className="admin-error">{state.error}</p>}

      <label>
        Slug{' '}
        <span className="admin-hint">
          (URL identifier, e.g. flower — cannot be changed later)
        </span>
        <input
          name="slug"
          placeholder="flower"
          pattern="[a-z0-9-]+"
          required
          value={slug}
          onChange={e => setSlug(e.target.value.trim().toLowerCase())}
        />
      </label>

      <label>
        Name
        <input name="name" required />
      </label>

      <label>
        Category
        <select name="category" required>
          <option value="">Select…</option>
          {categories.map(cat => (
            <option key={cat.slug} value={cat.slug}>
              {cat.label}
            </option>
          ))}
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

      {slug && (
        <fieldset className="admin-fieldset">
          <legend>Featured Image</legend>
          <span className="admin-hint">
            Gallery images can be added after saving.
          </span>
          <ProductImageUpload slug={slug} />
        </fieldset>
      )}

      <fieldset className="admin-fieldset">
        <legend>Certificate of Analysis (COA)</legend>
        <CoaSelector />
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>Cannabis Profile</legend>
        <span className="admin-hint">All fields are optional.</span>

        <label>
          Strain
          <select name="strain">
            <option value="">Select…</option>
            <option value="indica">Indica</option>
            <option value="sativa">Sativa</option>
            <option value="hybrid">Hybrid</option>
            <option value="cbd">CBD</option>
          </select>
        </label>

        <label>
          Effects{' '}
          <span className="admin-hint">
            Comma-separated, e.g. &quot;Euphoria, Relaxed, Sedative&quot;
          </span>
          <input name="effects" placeholder="Euphoria, Relaxed, Sedative" />
        </label>

        <label>
          Flavors{' '}
          <span className="admin-hint">
            Comma-separated, e.g. &quot;Citrus, Pine, Earthy&quot;
          </span>
          <input name="flavors" placeholder="Citrus, Pine, Earthy" />
        </label>

        <label>
          What to Expect{' '}
          <span className="admin-hint">One bullet per line.</span>
          <textarea
            name="whatToExpect"
            rows={4}
            placeholder="Uplifting, creative energy&#10;Great for daytime use"
          />
        </label>

        <fieldset className="admin-fieldset">
          <legend>Effect Scores (0–100)</legend>
          <span className="admin-hint">
            Leave blank to omit from storefront.
          </span>
          <label>
            Relaxation
            <input
              name="effectScores_relaxation"
              type="number"
              min={0}
              max={100}
            />
          </label>
          <label>
            Energy
            <input name="effectScores_energy" type="number" min={0} max={100} />
          </label>
          <label>
            Creativity
            <input
              name="effectScores_creativity"
              type="number"
              min={0}
              max={100}
            />
          </label>
          <label>
            Euphoria
            <input
              name="effectScores_euphoria"
              type="number"
              min={0}
              max={100}
            />
          </label>
          <label>
            Focus
            <input name="effectScores_focus" type="number" min={0} max={100} />
          </label>
          <label>
            Pain Relief
            <input
              name="effectScores_painRelief"
              type="number"
              min={0}
              max={100}
            />
          </label>
        </fieldset>
      </fieldset>

      <div className="admin-form-actions">
        <Link href="/admin/products">Cancel</Link>
        <button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create Product'}
        </button>
      </div>
    </form>
  );
}
