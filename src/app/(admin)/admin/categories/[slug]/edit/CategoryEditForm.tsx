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
        <span className="admin-hint">(integer \u2014 lower numbers appear first)</span>
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

      <fieldset className="admin-fieldset">
        <legend>Product Form Contract</legend>
        <span className="admin-hint">
          Controls which form sections appear when creating or editing a product
          in this category.
        </span>

        <label className="admin-checkbox">
          <input
            type="checkbox"
            name="requiresCannabisProfile"
            value="true"
            defaultChecked={category.requiresCannabisProfile}
          />
          Show Cannabis Profile{' '}
          <span className="admin-hint">
            (strain, effects, flavors, lab results)
          </span>
        </label>

        <label className="admin-checkbox">
          <input
            type="checkbox"
            name="requiresNutritionFacts"
            value="true"
            defaultChecked={category.requiresNutritionFacts}
          />
          Show Nutrition Facts{' '}
          <span className="admin-hint">(FDA nutrition facts panel)</span>
        </label>

        <label className="admin-checkbox">
          <input
            type="checkbox"
            name="requiresCOA"
            value="true"
            defaultChecked={category.requiresCOA}
          />
          Show COA Section{' '}
          <span className="admin-hint">
            (certificate of analysis upload)
          </span>
        </label>
      </fieldset>

      <div className="admin-form-actions">
        <Link href="/admin/categories">Cancel</Link>
        <button type="submit" disabled={pending}>
          {pending ? 'Saving\u2026' : 'Save'}
        </button>
      </div>
    </form>
  );
}
