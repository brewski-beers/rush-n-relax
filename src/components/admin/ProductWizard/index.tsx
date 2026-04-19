'use client';

/**
 * ProductWizardForm — shared multi-step wizard for product create and edit.
 *
 * All step content is always rendered in the DOM; non-active steps are hidden
 * via the `wizard-step--hidden` CSS class. This ensures hidden inputs from
 * TagInput / VariantEditor / CoaSelector are always present for FormData
 * submission via useActionState.
 *
 * Step structure:
 *   1. Vendor
 *   2. Category & Name
 *   3. Description (+ cannabis profile when requiresCannabisProfile)
 *   4. Lab Results (+ COA when requiresCOA)
 *   5. Availability & Compliance (+ nutrition facts when requiresNutritionFacts)
 *   6. Images
 *
 * Category contract flags (requiresCannabisProfile, requiresNutritionFacts,
 * requiresCOA) are sourced from the selected ProductCategorySummary and gate
 * which form sections are visible.
 */

import { useState, useActionState } from 'react';
import Link from 'next/link';
import { ProductImageUpload } from '@/components/admin/ProductImageUpload';
import { CoaSelector } from '@/components/admin/CoaSelector';
import { TagInput } from '@/components/admin/TagInput';
import { VariantEditor } from '@/components/admin/VariantEditor';
import { NutritionFactsFields } from '@/components/admin/NutritionFactsFields';
import type {
  Product,
  ProductCategorySummary,
  VariantTemplate,
  VendorSummary,
} from '@/types';

// --- Types -------------------------------------------------------------------

type Mode = 'create' | 'edit';

interface Props {
  mode: Mode;
  product?: Product;
  /** Initial category summary for edit mode — pre-selects the product's category */
  initialCategory?: ProductCategorySummary;
  categories: ProductCategorySummary[];
  variantTemplates: VariantTemplate[];
  vendors: VendorSummary[];
  /**
   * Whether the current user holds the `owner` role.
   * When true (edit mode only), the Status field is shown in Step 4.
   * Defaults to false (safe default — hides privileged field).
   */
  isOwner?: boolean;
  /** Server action bound appropriately by caller */
  action: (
    prev: { error?: string } | null,
    formData: FormData
  ) => Promise<{ error?: string }>;
}

// --- Constants ---------------------------------------------------------------

const TOTAL_STEPS = 5;

const STEP_TITLES: Record<number, string> = {
  1: 'Category & Name',
  2: 'Details',
  3: 'Lab Results',
  4: 'Variants',
  5: 'Images',
};

// --- Per-step validation -----------------------------------------------------

/**
 * Returns an error string if the current step has invalid data,
 * or null if it's OK to advance.
 * Uses the form DOM to read current field values.
 */
function validateStep(step: number, form: HTMLFormElement): string | null {
  const v = (name: string) =>
    (form.elements.namedItem(name) as HTMLInputElement | null)?.value?.trim() ??
    '';

  if (step === 1) {
    if (!v('category')) return 'Please select a category.';
    if (!v('name')) return 'Product name is required.';
    const slug = v('slug');
    if (!slug) return 'Slug is required.';
    if (!/^[a-z0-9-]+$/.test(slug))
      return 'Slug must be lowercase letters, numbers, and hyphens only.';
  }
  if (step === 2) {
    if (!v('details')) return 'Description is required.';
  }
  return null;
}

// --- Slug helper -------------------------------------------------------------

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// --- Component ---------------------------------------------------------------

export function ProductWizardForm({
  mode,
  product,
  initialCategory,
  categories,
  variantTemplates,
  vendors,
  isOwner = false,
  action,
}: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const [step, setStep] = useState(1);
  const [stepError, setStepError] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);

  // Controlled inputs that need auto-suggest or inter-field logic
  const [name, setName] = useState(product?.name ?? '');
  const [slug, setSlug] = useState(product?.slug ?? '');

  // Track selected category to gate form sections by contract flags.
  // Edit mode pre-selects via initialCategory; create mode starts undefined.
  const [selectedCategory, setSelectedCategory] = useState<
    ProductCategorySummary | undefined
  >(initialCategory);

  function getForm(): HTMLFormElement | null {
    return document.querySelector<HTMLFormElement>('form.admin-form');
  }

  function goNext() {
    const form = getForm();
    const err = form ? validateStep(step, form) : null;
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    setStep(s => Math.min(s + 1, TOTAL_STEPS));
  }

  function goBack() {
    setStepError(null);
    setStep(s => Math.max(s - 1, 1));
  }

  function isHidden(targetStep: number) {
    return step !== targetStep;
  }

  function handleCategoryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const cat = categories.find(c => c.slug === e.target.value);
    setSelectedCategory(cat);
  }

  const isLastStep = step === TOTAL_STEPS;
  const showStatusField = mode === 'edit' && isOwner;
  const submitLabel =
    mode === 'create'
      ? pending
        ? 'Creating...'
        : 'Create Product'
      : pending
        ? 'Saving...'
        : 'Save Changes';

  // Contract flags derived from the selected category.
  // Default false when no category selected yet (create mode, step 2 not yet reached).
  const showCannabisProfile = selectedCategory?.requiresCannabisProfile ?? false;
  const showNutritionFacts = selectedCategory?.requiresNutritionFacts ?? false;
  const showCOA = selectedCategory?.requiresCOA ?? false;

  return (
    <form action={formAction} className="admin-form">
      {/* Step indicator */}
      <p className="wizard-step-indicator" aria-live="polite">
        Step {step} of {TOTAL_STEPS} — {STEP_TITLES[step]}
      </p>

      {state?.error && <p className="admin-error">{state.error}</p>}
      {stepError && <p className="admin-error">{stepError}</p>}

      {/* ── Step 1: Category & Name ────────────────────────────── */}
      <div
        className={
          isHidden(1) ? 'wizard-step wizard-step--hidden' : 'wizard-step'
        }
        aria-hidden={isHidden(1)}
      >
        <fieldset className="admin-fieldset">
          <legend>Category &amp; Name</legend>
          <label>
            Category
            <select
              name="category"
              defaultValue={product?.category ?? ''}
              onChange={handleCategoryChange}
            >
              <option value="">Select...</option>
              {categories.map(cat => (
                <option key={cat.slug} value={cat.slug}>
                  {cat.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Name
            <input
              name="name"
              type="text"
              value={name}
              required
              placeholder="e.g. Sour Diesel"
              onChange={e => {
                const n = e.target.value;
                setName(n);
                if (mode === 'create') setSlug(slugify(n));
              }}
            />
          </label>

          <label>
            Slug{' '}
            <span className="admin-hint">
              {mode === 'create'
                ? '(URL identifier — cannot be changed later)'
                : '(read-only)'}
            </span>
            <input
              name="slug"
              type="text"
              value={slug}
              required
              pattern="[a-z0-9-]+"
              placeholder="sour-diesel"
              readOnly={mode === 'edit'}
              className={mode === 'edit' ? 'admin-input-readonly' : undefined}
              onChange={e =>
                mode === 'create' &&
                setSlug(e.target.value.toLowerCase().trim())
              }
            />
          </label>
        </fieldset>
      </div>

      {/* ── Step 2: Details ────────────────────────────────────── */}
      <div
        className={
          isHidden(2) ? 'wizard-step wizard-step--hidden' : 'wizard-step'
        }
        aria-hidden={isHidden(2)}
      >
        <fieldset className="admin-fieldset">
          <legend>Details</legend>
          <label>
            Description
            <textarea
              name="details"
              rows={6}
              required
              defaultValue={product?.details ?? ''}
              placeholder="Describe this product for customers..."
            />
          </label>

          <label>
            Vendor <span className="admin-hint">(optional)</span>
            <select name="vendorSlug" defaultValue={product?.vendorSlug ?? ''}>
              <option value="">— None —</option>
              {vendors
                .filter(v => v.isActive)
                .map(v => (
                  <option key={v.slug} value={v.slug}>
                    {v.name}
                  </option>
                ))}
            </select>
          </label>

          <label>
            Leafly URL <span className="admin-hint">(optional)</span>
            <input
              name="leaflyUrl"
              type="url"
              defaultValue={product?.leaflyUrl ?? ''}
              placeholder="https://www.leafly.com/strains/..."
            />
          </label>

          {showCannabisProfile && (
            <>
              <label>
                Strain <span className="admin-hint">(optional)</span>
                <select name="strain" defaultValue={product?.strain ?? ''}>
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
                initialTags={product?.effects ?? []}
                placeholder="e.g. Euphoria"
              />

              <TagInput
                name="flavors"
                label="Flavors"
                hint="Press Enter or comma to add each one."
                initialTags={product?.flavors ?? []}
                placeholder="e.g. Earthy"
              />
            </>
          )}
        </fieldset>
      </div>

      {/* ── Step 3: Lab Results ────────────────────────────────── */}
      <div
        className={
          isHidden(3) ? 'wizard-step wizard-step--hidden' : 'wizard-step'
        }
        aria-hidden={isHidden(3)}
      >
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
              defaultValue={product?.labResults?.thcPercent ?? ''}
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
              defaultValue={product?.labResults?.cbdPercent ?? ''}
            />
          </label>

          <TagInput
            name="terpenes"
            label="Terpenes"
            hint="Press Enter or comma to add each one."
            initialTags={product?.labResults?.terpenes ?? []}
            placeholder="e.g. Myrcene"
          />

          <label>
            Test Date
            <input
              name="labResults_testDate"
              type="date"
              defaultValue={product?.labResults?.testDate ?? ''}
            />
          </label>

          <label>
            Lab Name
            <input
              name="labResults_labName"
              type="text"
              defaultValue={product?.labResults?.labName ?? ''}
              placeholder="e.g. Confident Cannabis"
            />
          </label>

          {showCOA && (
            <fieldset className="admin-fieldset">
              <legend>Certificate of Analysis (COA)</legend>
              <CoaSelector currentCoaUrl={product?.coaUrl} />
            </fieldset>
          )}
        </fieldset>
      </div>

      {/* ── Step 4: Variants ───────────────────────────────────── */}
      <div
        className={
          isHidden(4) ? 'wizard-step wizard-step--hidden' : 'wizard-step'
        }
        aria-hidden={isHidden(4)}
      >
        <fieldset className="admin-fieldset">
          <legend>Variants</legend>

          {showStatusField && (
            <label>
              Status
              {product?.status === 'compliance-hold' ? (
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
                <select
                  name="status"
                  defaultValue={product?.status ?? 'active'}
                  required
                >
                  <option value="active">Active</option>
                  <option value="pending-reformulation">
                    Pending Reformulation
                  </option>
                  <option value="archived">Archived</option>
                </select>
              )}
            </label>
          )}

          {showNutritionFacts && (
            <fieldset className="admin-fieldset">
              <legend>Nutrition Facts</legend>
              <span className="admin-hint">
                Required fields: Serving Size, Servings Per Container, Calories.
                Others are optional.
              </span>
              <NutritionFactsFields nutritionFacts={product?.nutritionFacts} />
            </fieldset>
          )}

          <VariantEditor
            initialGroups={product?.variantGroups ?? []}
            variantTemplates={variantTemplates}
          />
        </fieldset>
      </div>

      {/* ── Step 5: Images ─────────────────────────────────────── */}
      <div
        className={
          isHidden(5) ? 'wizard-step wizard-step--hidden' : 'wizard-step'
        }
        aria-hidden={isHidden(5)}
      >
        <fieldset className="admin-fieldset">
          <legend>Images</legend>
          <ProductImageUpload
            slug={slug || product?.slug || ''}
            initialFeaturedPath={mode === 'edit' ? product?.image : undefined}
            initialGalleryPaths={
              mode === 'edit' ? product?.images : undefined
            }
            onUploadingChange={setImageUploading}
          />
        </fieldset>
      </div>

      {/* ── Navigation ─────────────────────────────────────────── */}
      <div className="wizard-nav admin-form-actions">
        {step === 1 ? (
          <Link href="/admin/products">Cancel</Link>
        ) : (
          <button type="button" onClick={goBack} disabled={pending}>
            Back
          </button>
        )}

        {!isLastStep ? (
          <button type="button" onClick={goNext}>
            Next
          </button>
        ) : (
          <button type="submit" disabled={pending || imageUploading}>
            {imageUploading ? 'Uploading image...' : submitLabel}
          </button>
        )}
      </div>
    </form>
  );
}
