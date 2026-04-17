'use client';

import { useState, useActionState } from 'react';
import Link from 'next/link';
import { updateProduct } from './actions';
import { ProductImageUpload } from '@/components/admin/ProductImageUpload';
import { CoaSelector } from '@/components/admin/CoaSelector';
import { TagInput } from '@/components/admin/TagInput';
import { VariantEditor } from '@/components/admin/VariantEditor';
import type {
  Product,
  ProductCategorySummary,
  VariantTemplate,
  VendorSummary,
} from '@/types';

interface Props {
  product: Product;
  categories: ProductCategorySummary[];
  variantTemplates: VariantTemplate[];
  vendors: VendorSummary[];
}

export function ProductEditForm({
  product,
  categories,
  variantTemplates,
  vendors,
}: Props) {
  const boundAction = updateProduct.bind(null, product.slug);
  const [state, formAction, pending] = useActionState(boundAction, null);
  const [imageUploading, setImageUploading] = useState(false);

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
        Vendor <span className="admin-hint">(optional)</span>
        <select name="vendorSlug" defaultValue={product.vendorSlug ?? ''}>
          <option value="">— None —</option>
          {vendors.map(v => (
            <option key={v.slug} value={v.slug}>
              {v.name}
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
          onUploadingChange={setImageUploading}
        />
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>Certificate of Analysis (COA)</legend>
        <CoaSelector currentCoaUrl={product.coaUrl} />
      </fieldset>

      <VariantEditor
        initialVariants={product.variants ?? []}
        variantTemplates={variantTemplates}
      />

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
              defaultValue={product.labResults?.thcPercent ?? ''}
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
              defaultValue={product.labResults?.cbdPercent ?? ''}
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
            initialTags={product.labResults?.terpenes ?? []}
            placeholder="e.g. Myrcene"
          />

          <label>
            Test Date
            <input
              name="labResults_testDate"
              type="date"
              defaultValue={product.labResults?.testDate ?? ''}
            />
          </label>

          <label>
            Lab Name
            <input
              name="labResults_labName"
              type="text"
              defaultValue={product.labResults?.labName ?? ''}
              placeholder="e.g. Confident Cannabis"
            />
          </label>
        </fieldset>
      </fieldset>

      <p className="admin-hint">
        Location availability is managed per-location. Go to{' '}
        <Link href="/admin/inventory">Inventory</Link> to set which locations
        carry this product.
      </p>

      {product.category === 'edibles' && (
        <fieldset className="admin-fieldset">
          <legend>Nutrition Facts</legend>
          <span className="admin-hint">
            Optional. Displayed as an FDA-style label on the product page.
          </span>
          <label>
            Serving Size
            <input
              name="nfServingSize"
              defaultValue={product.nutritionFacts?.servingSize ?? ''}
              placeholder="e.g. 1 gummy (5g)"
            />
          </label>
          <label>
            Servings Per Container
            <input
              name="nfServingsPerContainer"
              type="number"
              min={1}
              defaultValue={product.nutritionFacts?.servingsPerContainer ?? ''}
              placeholder="e.g. 10"
            />
          </label>
          <label>
            Calories
            <input
              name="nfCalories"
              type="number"
              min={0}
              defaultValue={product.nutritionFacts?.calories ?? ''}
              placeholder="e.g. 25"
            />
          </label>
          <label>
            Total Fat <span className="admin-hint">(e.g. 0g)</span>
            <input
              name="nfTotalFat"
              defaultValue={product.nutritionFacts?.totalFat ?? ''}
              placeholder="0g"
            />
          </label>
          <label>
            Sodium <span className="admin-hint">(e.g. 5mg)</span>
            <input
              name="nfSodium"
              defaultValue={product.nutritionFacts?.sodium ?? ''}
              placeholder="5mg"
            />
          </label>
          <label>
            Total Carbohydrate <span className="admin-hint">(e.g. 6g)</span>
            <input
              name="nfTotalCarbs"
              defaultValue={product.nutritionFacts?.totalCarbs ?? ''}
              placeholder="6g"
            />
          </label>
          <label>
            Sugars <span className="admin-hint">(e.g. 5g)</span>
            <input
              name="nfSugars"
              defaultValue={product.nutritionFacts?.sugars ?? ''}
              placeholder="5g"
            />
          </label>
          <label>
            Protein <span className="admin-hint">(e.g. 0g)</span>
            <input
              name="nfProtein"
              defaultValue={product.nutritionFacts?.protein ?? ''}
              placeholder="0g"
            />
          </label>
        </fieldset>
      )}

      <fieldset className="admin-fieldset">
        <legend>Leafly Reference</legend>
        <span className="admin-hint">
          Staff-only. Paste the Leafly strain URL to cross-reference
          descriptions and data sheets.
        </span>
        {product.leaflyUrl ? (
          <a
            href={product.leaflyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="admin-external-link"
          >
            View on Leafly ↗
          </a>
        ) : (
          <p className="admin-hint admin-muted">No Leafly match set.</p>
        )}
        <label>
          Leafly URL
          <input
            name="leaflyUrl"
            type="url"
            defaultValue={product.leaflyUrl ?? ''}
            placeholder="https://www.leafly.com/strains/…"
          />
        </label>
      </fieldset>

      <div className="admin-form-actions">
        <Link href="/admin/products">Cancel</Link>
        <button type="submit" disabled={pending || imageUploading}>
          {imageUploading ? 'Uploading image…' : pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
