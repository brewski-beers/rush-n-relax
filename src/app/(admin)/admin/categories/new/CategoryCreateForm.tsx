'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createCategory } from './actions';

export function CategoryCreateForm() {
  const [state, formAction, pending] = useActionState(createCategory, null);

  return (
    <form action={formAction} className="admin-form">
      {state?.error && <p className="admin-error">{state.error}</p>}

      <label>
        Slug{' '}
        <span className="admin-hint">
          (unique document ID, e.g. flower \u2014 cannot be changed later)
        </span>
        <input
          name="slug"
          placeholder="flower"
          pattern="[a-z0-9-]+"
          required
        />
      </label>

      <label>
        Label
        <input name="label" placeholder="Flower" required />
      </label>

      <label>
        Description
        <textarea name="description" rows={3} required />
      </label>

      <label>
        Order{' '}
        <span className="admin-hint">(integer \u2014 lower numbers appear first)</span>
        <input name="order" type="number" min={1} step={1} required />
      </label>

      <label className="admin-checkbox">
        <input type="checkbox" name="isActive" value="true" defaultChecked />
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
          />
          Show Nutrition Facts{' '}
          <span className="admin-hint">(FDA nutrition facts panel)</span>
        </label>

        <label className="admin-checkbox">
          <input type="checkbox" name="requiresCOA" value="true" />
          Show COA Section{' '}
          <span className="admin-hint">
            (certificate of analysis upload)
          </span>
        </label>
      </fieldset>

      <div className="admin-form-actions">
        <Link href="/admin/categories">Cancel</Link>
        <button type="submit" disabled={pending}>
          {pending ? 'Creating\u2026' : 'Create Category'}
        </button>
      </div>
    </form>
  );
}
