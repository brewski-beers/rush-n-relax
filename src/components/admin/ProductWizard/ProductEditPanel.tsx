'use client';

import { useState, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
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

// ─── Category Config (inlined — YAGNI) ───────────────────────────────────────

interface CategoryConfig {
  configuratorTitle: string | null;
  hasLeaflyUrl: boolean;
  hasFlowerProfile: boolean;
  hasLabResults: boolean;
  hasVapeAttributes: boolean;
  hasDrinkAttributes: boolean;
  hasNutritionFacts: boolean;
}

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  flower: {
    configuratorTitle: 'Flower Profile',
    hasLeaflyUrl: true,
    hasFlowerProfile: true,
    hasLabResults: true,
    hasVapeAttributes: false,
    hasDrinkAttributes: false,
    hasNutritionFacts: false,
  },
  concentrates: {
    configuratorTitle: 'Lab Results',
    hasLeaflyUrl: false,
    hasFlowerProfile: false,
    hasLabResults: true,
    hasVapeAttributes: false,
    hasDrinkAttributes: false,
    hasNutritionFacts: false,
  },
  edibles: {
    configuratorTitle: 'Nutrition Facts',
    hasLeaflyUrl: false,
    hasFlowerProfile: false,
    hasLabResults: false,
    hasVapeAttributes: false,
    hasDrinkAttributes: false,
    hasNutritionFacts: true,
  },
  vapes: {
    configuratorTitle: 'Product Details',
    hasLeaflyUrl: false,
    hasFlowerProfile: false,
    hasLabResults: true,
    hasVapeAttributes: true,
    hasDrinkAttributes: false,
    hasNutritionFacts: false,
  },
  drinks: {
    configuratorTitle: 'Drink Details',
    hasLeaflyUrl: false,
    hasFlowerProfile: false,
    hasLabResults: false,
    hasVapeAttributes: false,
    hasDrinkAttributes: true,
    hasNutritionFacts: false,
  },
};

const DEFAULT_CONFIG: CategoryConfig = {
  configuratorTitle: null,
  hasLeaflyUrl: false,
  hasFlowerProfile: false,
  hasLabResults: false,
  hasVapeAttributes: false,
  hasDrinkAttributes: false,
  hasNutritionFacts: false,
};

function getCategoryConfig(category: string): CategoryConfig {
  return CATEGORY_CONFIG[category] ?? DEFAULT_CONFIG;
}

// ─── Submit Button (uses useFormStatus) ──────────────────────────────────────

function SubmitButton({ imageUploading }: { imageUploading: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || imageUploading}>
      {imageUploading
        ? 'Uploading\u2026'
        : pending
          ? 'Saving\u2026'
          : 'Save Changes'}
    </button>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  product: Product;
  categories: ProductCategorySummary[];
  variantTemplates: VariantTemplate[];
  vendors: VendorSummary[];
  action: (
    prev: { error?: string } | null,
    formData: FormData
  ) => Promise<{ error?: string }>;
  archiveAction: (slug: string) => Promise<void>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ProductEditPanel({
  product,
  categories,
  variantTemplates,
  vendors,
  action,
  archiveAction,
}: Props) {
  const [state, formAction] = useActionState(action, null);
  const [imageUploading, setImageUploading] = useState(false);

  const catConfig = getCategoryConfig(product.category);
  const categoryLabel =
    categories.find(c => c.slug === product.category)?.label ??
    product.category;

  const boundArchive = archiveAction.bind(null, product.slug);

  return (
    <form action={formAction} className="admin-form">
      {state?.error && <p className="admin-error">{state.error}</p>}

      {/* ── Identity (read-only) ──────────────────────────────────── */}
      <fieldset className="admin-fieldset">
        <legend>Product</legend>
        {/* Hidden inputs so FormData includes identity fields */}
        <input type="hidden" name="name" value={product.name} />
        <input type="hidden" name="category" value={product.category} />
        <input type="hidden" name="slug" value={product.slug} />

        <label>
          Category
          <span className="admin-input-readonly">{categoryLabel}</span>
        </label>
        <label>
          Name
          <span className="admin-input-readonly">{product.name}</span>
        </label>
        <label>
          Slug
          <span className="admin-input-readonly">{product.slug}</span>
        </label>
      </fieldset>

      {/* ── Vendor ───────────────────────────────────────────────── */}
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

      {/* ── Description ──────────────────────────────────────────── */}
      <label>
        Details
        <textarea
          name="details"
          rows={6}
          required
          defaultValue={product.details}
        />
      </label>

      {/* ── Category Configurator ─────────────────────────────────── */}
      {catConfig.configuratorTitle && (
        <fieldset className="admin-fieldset">
          <legend>{catConfig.configuratorTitle}</legend>

          {catConfig.hasLeaflyUrl && (
            <label>
              Leafly URL <span className="admin-hint">(optional)</span>
              <input
                name="leaflyUrl"
                type="url"
                defaultValue={product.leaflyUrl ?? ''}
                placeholder="https://www.leafly.com/strains/\u2026"
              />
            </label>
          )}

          {catConfig.hasFlowerProfile && (
            <>
              <p className="admin-section-title">Cannabis Profile</p>
              <label>
                Strain <span className="admin-hint">(optional)</span>
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
            </>
          )}

          {catConfig.hasVapeAttributes && (
            <>
              <p className="admin-section-title">Hardware</p>
              <label>
                Hardware Type
                <select
                  name="hardwareType"
                  defaultValue={product.hardwareType ?? ''}
                >
                  <option value="">— Select —</option>
                  <option value="cartridge">Cartridge (510)</option>
                  <option value="disposable">Disposable</option>
                  <option value="all-in-one">All-in-One</option>
                </select>
              </label>
              <label>
                Extraction Type
                <select
                  name="extractionType"
                  defaultValue={product.extractionType ?? ''}
                >
                  <option value="">— Select —</option>
                  <option value="distillate">Distillate</option>
                  <option value="live-resin">Live Resin</option>
                  <option value="full-spectrum">Full Spectrum</option>
                  <option value="broad-spectrum">Broad Spectrum</option>
                </select>
              </label>
              <label>
                Volume (mL) <span className="admin-hint">(optional)</span>
                <input
                  name="volumeMl"
                  type="number"
                  min="0.1"
                  max="5"
                  step="0.1"
                  defaultValue={product.volumeMl ?? ''}
                  placeholder="e.g. 1.0"
                />
              </label>
            </>
          )}

          {catConfig.hasDrinkAttributes && (
            <>
              <p className="admin-section-title">Dosage &amp; Serving</p>
              <label>
                THC per Serving (mg)
                <input
                  name="thcMgPerServing"
                  type="number"
                  min="0"
                  step="0.1"
                  defaultValue={product.thcMgPerServing ?? ''}
                  placeholder="e.g. 5"
                />
              </label>
              <label>
                CBD per Serving (mg){' '}
                <span className="admin-hint">(optional)</span>
                <input
                  name="cbdMgPerServing"
                  type="number"
                  min="0"
                  step="0.1"
                  defaultValue={product.cbdMgPerServing ?? ''}
                  placeholder="e.g. 2"
                />
              </label>
              <label>
                Serving Size <span className="admin-hint">(e.g. 12 fl oz)</span>
                <input
                  name="nfServingSize"
                  defaultValue={product.nutritionFacts?.servingSize ?? ''}
                  placeholder="e.g. 12 fl oz"
                />
              </label>
              <label>
                Servings Per Container
                <input
                  name="nfServingsPerContainer"
                  type="number"
                  min={1}
                  defaultValue={
                    product.nutritionFacts?.servingsPerContainer ?? ''
                  }
                  placeholder="e.g. 1"
                />
              </label>
              <TagInput
                name="flavors"
                label="Flavor Profile"
                hint="Press Enter or comma to add each one."
                initialTags={product.flavors ?? []}
                placeholder="e.g. Berry Lemon"
              />
            </>
          )}

          {catConfig.hasLabResults && (
            <>
              <p className="admin-section-title">Lab Results</p>
              <span className="admin-hint">All fields optional.</span>
              <label>
                THC %
                <input
                  name="labResults_thcPercent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  defaultValue={product.labResults?.thcPercent ?? ''}
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
              <p className="admin-section-title">
                Certificate of Analysis (COA)
              </p>
              <CoaSelector currentCoaUrl={product.coaUrl} />
            </>
          )}

          {catConfig.hasNutritionFacts && (
            <>
              <p className="admin-section-title">Nutrition Facts</p>
              <span className="admin-hint">
                Displayed as an FDA-style label on the product page.
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
                  defaultValue={
                    product.nutritionFacts?.servingsPerContainer ?? ''
                  }
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
            </>
          )}
        </fieldset>
      )}

      {/* ── Hidden passthrough fields for fields NOT shown ────────── */}
      {!catConfig.hasLeaflyUrl && (
        <input type="hidden" name="leaflyUrl" value={product.leaflyUrl ?? ''} />
      )}
      {!catConfig.hasFlowerProfile && !catConfig.hasDrinkAttributes && (
        <>
          <input type="hidden" name="strain" value={product.strain ?? ''} />
          <input
            type="hidden"
            name="effects"
            value={(product.effects ?? []).join(',')}
          />
          <input
            type="hidden"
            name="flavors"
            value={(product.flavors ?? []).join(',')}
          />
        </>
      )}
      {!catConfig.hasLabResults && (
        <>
          <input
            type="hidden"
            name="labResults_thcPercent"
            value={product.labResults?.thcPercent ?? ''}
          />
          <input
            type="hidden"
            name="labResults_cbdPercent"
            value={product.labResults?.cbdPercent ?? ''}
          />
          <input
            type="hidden"
            name="terpenes"
            value={(product.labResults?.terpenes ?? []).join(',')}
          />
          <input
            type="hidden"
            name="labResults_testDate"
            value={product.labResults?.testDate ?? ''}
          />
          <input
            type="hidden"
            name="labResults_labName"
            value={product.labResults?.labName ?? ''}
          />
          <input type="hidden" name="coaUrl" value={product.coaUrl ?? ''} />
        </>
      )}
      {!catConfig.hasVapeAttributes && (
        <>
          <input
            type="hidden"
            name="hardwareType"
            value={product.hardwareType ?? ''}
          />
          <input
            type="hidden"
            name="extractionType"
            value={product.extractionType ?? ''}
          />
          <input type="hidden" name="volumeMl" value={product.volumeMl ?? ''} />
        </>
      )}
      {!catConfig.hasDrinkAttributes && (
        <>
          <input
            type="hidden"
            name="thcMgPerServing"
            value={product.thcMgPerServing ?? ''}
          />
          <input
            type="hidden"
            name="cbdMgPerServing"
            value={product.cbdMgPerServing ?? ''}
          />
        </>
      )}
      {!catConfig.hasNutritionFacts && !catConfig.hasDrinkAttributes && (
        <>
          <input
            type="hidden"
            name="nfServingSize"
            value={product.nutritionFacts?.servingSize ?? ''}
          />
          <input
            type="hidden"
            name="nfServingsPerContainer"
            value={product.nutritionFacts?.servingsPerContainer ?? ''}
          />
        </>
      )}
      {!catConfig.hasNutritionFacts && (
        <>
          <input
            type="hidden"
            name="nfCalories"
            value={product.nutritionFacts?.calories ?? ''}
          />
          <input
            type="hidden"
            name="nfTotalFat"
            value={product.nutritionFacts?.totalFat ?? ''}
          />
          <input
            type="hidden"
            name="nfSodium"
            value={product.nutritionFacts?.sodium ?? ''}
          />
          <input
            type="hidden"
            name="nfTotalCarbs"
            value={product.nutritionFacts?.totalCarbs ?? ''}
          />
          <input
            type="hidden"
            name="nfSugars"
            value={product.nutritionFacts?.sugars ?? ''}
          />
          <input
            type="hidden"
            name="nfProtein"
            value={product.nutritionFacts?.protein ?? ''}
          />
        </>
      )}

      {/* ── Variants ─────────────────────────────────────────────── */}
      <VariantEditor
        initialVariants={product.variants ?? []}
        initialSelectorLabel={product.variantSelectorLabel}
        variantTemplates={variantTemplates}
      />

      {/* ── Images ───────────────────────────────────────────────── */}
      <fieldset className="admin-fieldset">
        <legend>Images</legend>
        <ProductImageUpload
          slug={product.slug}
          initialFeaturedPath={product.image}
          initialGalleryPaths={product.images}
          onUploadingChange={setImageUploading}
        />
      </fieldset>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <div className="admin-form-actions">
        <Link href="/admin/products">Cancel</Link>
        <form action={boundArchive} className="admin-inline-form">
          <button
            type="submit"
            className="admin-btn-danger"
            onClick={e => {
              if (
                !window.confirm(
                  'Archive this product? It will be removed from the storefront.'
                )
              ) {
                e.preventDefault();
              }
            }}
            disabled={product.status === 'archived'}
          >
            {product.status === 'archived' ? 'Archived' : 'Archive'}
          </button>
        </form>
        <SubmitButton imageUploading={imageUploading} />
      </div>
    </form>
  );
}
