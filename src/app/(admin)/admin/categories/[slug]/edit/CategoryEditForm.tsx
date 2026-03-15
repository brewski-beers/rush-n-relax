'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { updateCategory } from './actions';
import type { ProductCategoryConfig } from '@/types';

interface Props {
  category: ProductCategoryConfig;
}

export function CategoryEditForm({ category }: Props) {
  const boundAction = updateCategory.bind(null, category.slug);
  const [state, formAction, pending] = useActionState(boundAction, null);

  return (
    <form action={formAction} className="admin-form">
      {state?.error && <p className="admin-error">{state.error}</p>}

      <label>
        Slug{' '}
        <span className="admin-hint">(cannot be changed)</span>
        <input
          value={category.slug}
          disabled
          className="admin-input-readonly"
          readOnly
        />
      </label>

      <label>
        Label
        <input name="label" defaultValue={category.label} required />
      </label>

      <label>
        Description
        <textarea
          name="description"
          defaultValue={category.description}
          rows={3}
          required
        />
      </label>

      <label>
        Order{' '}
        <span className="admin-hint">(integer — lower numbers appear first)</span>
        <input
          name="order"
          type="number"
          min={1}
          step={1}
          defaultValue={category.order}
          required
        />
      </label>

      <label className="admin-checkbox">
        <input
          type="checkbox"
          name="isActive"
          value="true"
          defaultChecked={category.isActive}
        />
        Active{' '}
        <span className="admin-hint">
          (inactive categories are hidden from the storefront and product forms)
        </span>
      </label>

      <div className="admin-form-actions">
        <Link href="/admin/categories">Cancel</Link>
        <button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
