'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { updateProduct } from './actions';
import { ProductImageUpload } from '@/components/admin/ProductImageUpload';
import { CoaSelector } from '@/components/admin/CoaSelector';
import { TagInput } from '@/components/admin/TagInput';
import type { Product, ProductCategorySummary } from '@/types';

interface Props {
  product: Product;
  categories: ProductCategorySummary[];
}

export function ProductEditForm({ product, categories }: Props) {
  const boundAction = updateProduct.bind(null, product.slug);
  const [state, formAction, pending] = useActionState(boundAction, null);

  return (
    <form action={formAction} className="admin-form">
      {state?.error && <p className="admin-error">{state.error}</p>}

      <label>
        Name
        <input name="name" defaultValue={product.name} required />
      </label>

      <label>
        Category
        <select name="category" defaultValue={product.category} required>
          {categories.map(cat => (
            <option key={cat.slug} value={cat.slug}>
              {cat.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Details
        <textarea
          name="details"
          defaultValue={product.details}
          rows={5}
          required
        />
      </label>

      <label>
        Status
        {product.status === 'compliance-hold' ? (
          <>
            <input type="hidden" name="status" value="compliance-hold" />
            <input
              value="compliance-hold"
              disabled
              className="admin-input-readonly"
            />
            <span className="admin-hint">
              Set by compliance system — cannot be changed here.
            </span>
          </>
        ) : (
          <select name="status" defaultValue={product.status} required>
            <option value="active">Active</option>
            <option value="pending-reformulation">Pending Reformulation</option>
            <option value="archived">Archived</option>
          </select>
        )}
      </label>

      <fieldset className="admin-fieldset">
        <legend>Images</legend>
        <ProductImageUpload
          slug={product.slug}
          initialFeaturedPath={product.image}
          initialGalleryPaths={product.images}
        />
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>Certificate of Analysis (COA)</legend>
        <CoaSelector currentCoaUrl={product.coaUrl} />
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>Cannabis Profile</legend>
        <span className="admin-hint">All fields are optional.</span>

        <label>
          Strain
          <select name="strain" defaultValue={product.strain ?? ''}>
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
          initialTags={product.effects ?? []}
          placeholder="e.g. Euphoria"
        />

        <TagInput
          name="flavors"
          label="Flavors"
          hint="Press Enter or comma to add each one."
          initialTags={product.flavors ?? []}
          placeholder="e.g. Earthy"
        />

        <TagInput
          name="whatToExpect"
          label="What to Expect"
          hint="Each entry becomes a bullet on the product page."
          initialTags={product.whatToExpect ?? []}
          placeholder="e.g. Calm euphoria settles the mind"
        />

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
              defaultValue={product.effectScores?.relaxation ?? ''}
            />
          </label>
          <label>
            Energy
            <input
              name="effectScores_energy"
              type="number"
              min={0}
              max={100}
              defaultValue={product.effectScores?.energy ?? ''}
            />
          </label>
          <label>
            Creativity
            <input
              name="effectScores_creativity"
              type="number"
              min={0}
              max={100}
              defaultValue={product.effectScores?.creativity ?? ''}
            />
          </label>
          <label>
            Euphoria
            <input
              name="effectScores_euphoria"
              type="number"
              min={0}
              max={100}
              defaultValue={product.effectScores?.euphoria ?? ''}
            />
          </label>
          <label>
            Focus
            <input
              name="effectScores_focus"
              type="number"
              min={0}
              max={100}
              defaultValue={product.effectScores?.focus ?? ''}
            />
          </label>
          <label>
            Pain Relief
            <input
              name="effectScores_painRelief"
              type="number"
              min={0}
              max={100}
              defaultValue={product.effectScores?.painRelief ?? ''}
            />
          </label>
        </fieldset>
      </fieldset>

      <div className="admin-form-actions">
        <Link href="/admin/products">Cancel</Link>
        <button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
