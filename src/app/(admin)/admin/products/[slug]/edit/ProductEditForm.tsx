'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { updateProduct } from './actions';
import { ProductImageUpload } from '@/components/admin/ProductImageUpload';
import type { Product, LocationSummary, ProductCategorySummary } from '@/types';

interface Props {
  product: Product;
  locations: LocationSummary[];
  categories: ProductCategorySummary[];
}

export function ProductEditForm({ product, locations, categories }: Props) {
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
        Description
        <textarea
          name="description"
          defaultValue={product.description}
          rows={3}
          required
        />
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
        <legend>Available At</legend>
        {locations.map(loc => (
          <label key={loc.slug} className="admin-checkbox">
            <input
              type="checkbox"
              name="availableAt"
              value={loc.slug}
              defaultChecked={product.availableAt.includes(loc.slug)}
            />
            {loc.name}
          </label>
        ))}
      </fieldset>

      <label className="admin-checkbox">
        <input
          type="checkbox"
          name="federalDeadlineRisk"
          value="true"
          defaultChecked={product.federalDeadlineRisk}
        />
        Federal deadline risk{' '}
        <span className="admin-hint">
          (≤0.4mg total THC — affected by Nov 2026 rule)
        </span>
      </label>

      <fieldset className="admin-fieldset">
        <legend>Images</legend>
        <ProductImageUpload
          slug={product.slug}
          initialFeaturedPath={product.image}
          initialGalleryPaths={product.images}
        />
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
