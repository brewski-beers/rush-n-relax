'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import Link from 'next/link';
import { createProduct } from './actions';
import { ProductImageUpload } from '@/components/admin/ProductImageUpload';
import { CoaSelector } from '@/components/admin/CoaSelector';
import { TagInput } from '@/components/admin/TagInput';
import { VariantEditor } from '@/components/admin/VariantEditor';
import type { ProductCategorySummary } from '@/types';

interface Props {
  categories: ProductCategorySummary[];
}

export function ProductCreateForm({ categories }: Props) {
  const [state, formAction, pending] = useActionState(createProduct, null);
  const [slug, setSlug] = useState('');
  const [imageUploading, setImageUploading] = useState(false);

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
        Details
        <textarea name="details" rows={5} required />
      </label>

      {slug && (
        <fieldset className="admin-fieldset">
          <legend>Featured Image</legend>
          <span className="admin-hint">
            Gallery images can be added after saving.
          </span>
          <ProductImageUpload
            slug={slug}
            onUploadingChange={setImageUploading}
          />
        </fieldset>
      )}

      <fieldset className="admin-fieldset">
        <legend>Certificate of Analysis (COA)</legend>
        <CoaSelector />
      </fieldset>

      <VariantEditor />

      <fieldset className="admin-fieldset">
        <legend>Cannabis Profile</legend>
        <span className="admin-hint">All fields are optional.</span>

        <label>
          Strain
          <select name="strain">
            <option value="">— None —</option>
            <option value="indica">Indica</option>
            <option value="sativa">Sativa</option>
            <option value="hybrid">Hybrid</option>
            <option value="cbd">CBD</option>
          </select>
        </label>

        <TagInput
          name="effects"
          label="Effects"
          hint="Press Enter or comma to add each one."
          placeholder="e.g. Euphoria"
        />

        <TagInput
          name="flavors"
          label="Flavors"
          hint="Press Enter or comma to add each one."
          placeholder="e.g. Earthy"
        />

        <fieldset className="admin-fieldset">
          <legend>Lab Results</legend>
          <span className="admin-hint">All fields are optional.</span>

          <label>
            THC %
            <input
              name="labResults_thcPercent"
              type="number"
              min="0"
              max="100"
              step="0.1"
              aria-describedby="thcPercent-error"
            />
            <p
              id="thcPercent-error"
              className="admin-field-error"
              aria-live="polite"
              hidden
            />
          </label>

          <label>
            CBD %
            <input
              name="labResults_cbdPercent"
              type="number"
              min="0"
              max="100"
              step="0.1"
              aria-describedby="cbdPercent-error"
            />
            <p
              id="cbdPercent-error"
              className="admin-field-error"
              aria-live="polite"
              hidden
            />
          </label>

          <TagInput
            name="terpenes"
            label="Terpenes"
            hint="Press Enter or comma to add each one."
            placeholder="e.g. Myrcene"
          />

          <label>
            Test Date
            <input name="labResults_testDate" type="date" />
          </label>

          <label>
            Lab Name
            <input
              name="labResults_labName"
              type="text"
              placeholder="e.g. Confident Cannabis"
            />
          </label>
        </fieldset>
      </fieldset>

      <div className="admin-form-actions">
        <Link href="/admin/products">Cancel</Link>
        <button type="submit" disabled={pending || imageUploading}>
          {imageUploading
            ? 'Uploading image…'
            : pending
              ? 'Creating…'
              : 'Create Product'}
        </button>
      </div>
    </form>
  );
}
