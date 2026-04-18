'use client';

/**
 * ProductWizardForm — category-first multi-step wizard for product create and edit.
 *
 * All step content is always rendered in the DOM; non-active steps are hidden
 * via the `wizard-step--hidden` CSS class. This ensures hidden inputs from
 * TagInput / VariantEditor / CoaSelector are always present for FormData
 * submission via useActionState.
 *
 * Fixed DOM steps:
 *   1. Category & Name  (category drives the configurator that follows)
 *   2. Description
 *   3. Category Configurator  (vendor + category-specific fields — skipped for unconfigured categories)
 *   4. Availability & Compliance  (variants, status)
 *   5. Images
 *
 * Step 3 content is fully driven by CATEGORY_CONFIG. Navigation skips step 3
 * when the selected category has no configurator title.
 */

import { useState, useActionState } from 'react';
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

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = 'create' | 'edit';

interface Props {
  mode: Mode;
  product?: Product;
  categories: ProductCategorySummary[];
  variantTemplates: VariantTemplate[];
  vendors: VendorSummary[];
  action: (
    prev: { error?: string } | null,
    formData: FormData
  ) => Promise<{ error?: string }>;
}

interface ReviewSnapshot {
  name: string;
  categoryLabel: string;
  slug: string;
  vendorName: string;
  details: string;
  strain: string;
  leaflyUrl: string;
  thcPct: string;
  coaUploaded: boolean;
  hardwareType: string;
  extractionType: string;
  volumeMl: string;
  thcMgPerServing: string;
  servingSize: string;
  flavors: string[];
  effects: string[];
  variantCount: number;
  hasFeaturedImage: boolean;
}

// ─── Category Configurator Map ────────────────────────────────────────────────

interface CategoryConfig {
  /** Step 3 title — null means skip step 3 entirely */
  configuratorTitle: string | null;
  hasFlowerProfile: boolean; // strain, effects, flavors
  hasLabResults: boolean; // THC %, CBD %, terpenes, COA, test date, lab name
  hasNutritionFacts: boolean; // full FDA label fields
  hasDrinkAttributes: boolean; // THC mg/serving, CBD mg/serving, serving info, flavor tags
  hasVapeAttributes: boolean; // extraction type, hardware type, volume
  hasLeaflyUrl: boolean; // Leafly URL visible only for flower
}

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  flower: {
    configuratorTitle: 'Flower Profile',
    hasFlowerProfile: true,
    hasLabResults: true,
    hasNutritionFacts: false,
    hasDrinkAttributes: false,
    hasVapeAttributes: false,
    hasLeaflyUrl: true,
  },
  concentrates: {
    configuratorTitle: 'Lab Results',
    hasFlowerProfile: false,
    hasLabResults: true,
    hasNutritionFacts: false,
    hasDrinkAttributes: false,
    hasVapeAttributes: false,
    hasLeaflyUrl: false,
  },
  edibles: {
    configuratorTitle: 'Nutrition Facts',
    hasFlowerProfile: false,
    hasLabResults: false,
    hasNutritionFacts: true,
    hasDrinkAttributes: false,
    hasVapeAttributes: false,
    hasLeaflyUrl: false,
  },
  vapes: {
    configuratorTitle: 'Product Details',
    hasFlowerProfile: false,
    hasLabResults: true,
    hasNutritionFacts: false,
    hasDrinkAttributes: false,
    hasVapeAttributes: true,
    hasLeaflyUrl: false,
  },
  drinks: {
    configuratorTitle: 'Drink Details',
    hasFlowerProfile: false,
    hasLabResults: false,
    hasNutritionFacts: false,
    hasDrinkAttributes: true,
    hasVapeAttributes: false,
    hasLeaflyUrl: false,
  },
};

const DEFAULT_CONFIG: CategoryConfig = {
  configuratorTitle: null,
  hasFlowerProfile: false,
  hasLabResults: false,
  hasNutritionFacts: false,
  hasDrinkAttributes: false,
  hasVapeAttributes: false,
  hasLeaflyUrl: false,
};

// ─── Step Sequence ────────────────────────────────────────────────────────────

function getCategoryConfig(category: string): CategoryConfig {
  return CATEGORY_CONFIG[category] ?? DEFAULT_CONFIG;
}

function getStepSequence(category: string): number[] {
  return getCategoryConfig(category).configuratorTitle
    ? [1, 2, 3, 4, 5, 6]
    : [1, 2, 4, 5, 6];
}

function getStepTitle(domStep: number, category: string): string {
  const titles: Record<number, string> = {
    1: 'Category & Name',
    2: 'Description',
    3: getCategoryConfig(category).configuratorTitle ?? '',
    4: 'Variants',
    5: 'Images',
    6: 'Review',
  };
  return titles[domStep] ?? '';
}

// ─── Review capture ───────────────────────────────────────────────────────────

function captureReview(
  form: HTMLFormElement,
  category: string,
  categories: ProductCategorySummary[],
  vendors: VendorSummary[]
): ReviewSnapshot {
  const v = (name: string) =>
    (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? '';
  const variantCount = (() => {
    try {
      // Read variantGroups JSON; count options across all groups as a proxy
      const raw = v('variantGroups');
      if (!raw) return 0;
      const parsed = JSON.parse(raw) as Array<{ options?: unknown[] }>;
      return parsed.reduce((sum, g) => sum + (g.options?.length ?? 0), 0);
    } catch {
      return 0;
    }
  })();
  return {
    name: v('name'),
    categoryLabel: categories.find(c => c.slug === category)?.label ?? category,
    slug: v('slug'),
    vendorName: vendors.find(vd => vd.slug === v('vendorSlug'))?.name ?? '',
    details: v('details'),
    strain: v('strain'),
    leaflyUrl: v('leaflyUrl'),
    thcPct: v('labResults_thcPercent'),
    coaUploaded: !!v('coaUrl'),
    hardwareType: v('hardwareType'),
    extractionType: v('extractionType'),
    volumeMl: v('volumeMl'),
    thcMgPerServing: v('thcMgPerServing'),
    servingSize: v('nfServingSize'),
    flavors: v('flavors').split(',').filter(Boolean),
    effects: v('effects').split(',').filter(Boolean),
    variantCount,
    hasFeaturedImage: !!v('featuredImagePath'),
  };
}

// ─── Per-step validation ──────────────────────────────────────────────────────

function validateStep(domStep: number, form: HTMLFormElement): string | null {
  const v = (name: string) =>
    (form.elements.namedItem(name) as HTMLInputElement | null)?.value?.trim() ??
    '';

  if (domStep === 1) {
    if (!v('category')) return 'Please select a category.';
    if (!v('name')) return 'Product name is required.';
    const slug = v('slug');
    if (!slug) return 'Slug is required.';
    if (!/^[a-z0-9-]+$/.test(slug))
      return 'Slug must be lowercase letters, numbers, and hyphens only.';
  }
  if (domStep === 2) {
    if (!v('details')) return 'Description is required.';
  }
  return null;
}

// ─── Slug helper ─────────────────────────────────────────────────────────────

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ProductWizardForm({
  mode,
  product,
  categories,
  variantTemplates,
  vendors,
  action,
}: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const [imageUploading, setImageUploading] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [reviewSnapshot, setReviewSnapshot] = useState<ReviewSnapshot | null>(
    null
  );

  const [name, setName] = useState(product?.name ?? '');
  const [slug, setSlug] = useState(product?.slug ?? '');
  const [category, setCategory] = useState(product?.category ?? '');

  const [domStep, setDomStep] = useState(1);

  const sequence = getStepSequence(category);
  const seqIndex = sequence.indexOf(domStep);
  const displayStep = seqIndex + 1;
  const totalSteps = sequence.length;
  const isLastStep = seqIndex === totalSteps - 1;

  const catConfig = getCategoryConfig(category);

  function getForm(): HTMLFormElement | null {
    return document.querySelector<HTMLFormElement>('form.admin-form');
  }

  function goNext() {
    const form = getForm();
    const err = form ? validateStep(domStep, form) : null;
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    const next = sequence[seqIndex + 1];
    if (next !== undefined) {
      if (next === 6 && form) {
        setReviewSnapshot(captureReview(form, category, categories, vendors));
      }
      setDomStep(next);
    }
  }

  function goBack() {
    setStepError(null);
    const prev = sequence[seqIndex - 1];
    if (prev !== undefined) setDomStep(prev);
  }

  const submitLabel =
    mode === 'create'
      ? pending
        ? 'Creating…'
        : 'Create Product'
      : pending
        ? 'Saving…'
        : 'Save Changes';

  return (
    <form action={formAction} className="admin-form">
      <p className="wizard-step-indicator" aria-live="polite">
        Step {displayStep} of {totalSteps} — {getStepTitle(domStep, category)}
      </p>

      {state?.error && <p className="admin-error">{state.error}</p>}
      {stepError && <p className="admin-error">{stepError}</p>}

      {/* ── Step 1: Category & Name ────────────────────────────── */}
      <div
        className={
          domStep !== 1 ? 'wizard-step wizard-step--hidden' : 'wizard-step'
        }
        aria-hidden={domStep !== 1}
      >
        <fieldset className="admin-fieldset">
          <legend>Category &amp; Name</legend>

          <label>
            Category
            <select
              name="category"
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              <option value="">Select…</option>
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

      {/* ── Step 2: Description ────────────────────────────────── */}
      <div
        className={
          domStep !== 2 ? 'wizard-step wizard-step--hidden' : 'wizard-step'
        }
        aria-hidden={domStep !== 2}
      >
        <fieldset className="admin-fieldset">
          <legend>Description</legend>
          <label>
            Details
            <textarea
              name="details"
              rows={6}
              required
              defaultValue={product?.details ?? ''}
              placeholder="Describe this product for customers…"
            />
          </label>
        </fieldset>
      </div>

      {/* ── Step 3: Category Configurator ─────────────────────── */}
      <div
        className={
          domStep !== 3 ? 'wizard-step wizard-step--hidden' : 'wizard-step'
        }
        aria-hidden={domStep !== 3}
      >
        <fieldset className="admin-fieldset">
          <legend>{catConfig.configuratorTitle ?? 'Details'}</legend>

          {/* Vendor — shown for all categories */}
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

          {/* Leafly URL — flower only */}
          {catConfig.hasLeaflyUrl ? (
            <label>
              Leafly URL{' '}
              <span className="admin-hint">
                (optional — staff-only reference)
              </span>
              <input
                name="leaflyUrl"
                type="url"
                defaultValue={product?.leaflyUrl ?? ''}
                placeholder="https://www.leafly.com/strains/…"
              />
            </label>
          ) : (
            <input
              type="hidden"
              name="leaflyUrl"
              value={product?.leaflyUrl ?? ''}
            />
          )}

          {/* ── Flower: cannabis profile ─────────────────────── */}
          {catConfig.hasFlowerProfile && (
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

          {/* ── Vape: hardware attributes ────────────────────── */}
          {catConfig.hasVapeAttributes && (
            <>
              <p className="admin-section-title">Hardware</p>
              <label>
                Hardware Type
                <select
                  name="hardwareType"
                  defaultValue={product?.hardwareType ?? ''}
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
                  defaultValue={product?.extractionType ?? ''}
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
                  defaultValue={product?.volumeMl ?? ''}
                  placeholder="e.g. 1.0"
                />
              </label>
            </>
          )}

          {/* ── Drink: dosage & serving ──────────────────────── */}
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
                  defaultValue={product?.thcMgPerServing ?? ''}
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
                  defaultValue={product?.cbdMgPerServing ?? ''}
                  placeholder="e.g. 2"
                />
              </label>

              <label>
                Serving Size <span className="admin-hint">(e.g. 12 fl oz)</span>
                <input
                  name="nfServingSize"
                  defaultValue={product?.nutritionFacts?.servingSize ?? ''}
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
                    product?.nutritionFacts?.servingsPerContainer ?? ''
                  }
                  placeholder="e.g. 1"
                />
              </label>

              <TagInput
                name="flavors"
                label="Flavor Profile"
                hint="Press Enter or comma to add each one."
                initialTags={product?.flavors ?? []}
                placeholder="e.g. Berry Lemon"
              />
            </>
          )}

          {/* ── Lab results (flower + concentrates + vapes) ──── */}
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

              <p className="admin-section-title">
                Certificate of Analysis (COA)
              </p>
              <CoaSelector currentCoaUrl={product?.coaUrl} />
            </>
          )}

          {/* ── Edibles: nutrition facts ─────────────────────── */}
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
                  defaultValue={product?.nutritionFacts?.servingSize ?? ''}
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
                    product?.nutritionFacts?.servingsPerContainer ?? ''
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
                  defaultValue={product?.nutritionFacts?.calories ?? ''}
                  placeholder="e.g. 25"
                />
              </label>
              <label>
                Total Fat <span className="admin-hint">(e.g. 0g)</span>
                <input
                  name="nfTotalFat"
                  defaultValue={product?.nutritionFacts?.totalFat ?? ''}
                  placeholder="0g"
                />
              </label>
              <label>
                Sodium <span className="admin-hint">(e.g. 5mg)</span>
                <input
                  name="nfSodium"
                  defaultValue={product?.nutritionFacts?.sodium ?? ''}
                  placeholder="5mg"
                />
              </label>
              <label>
                Total Carbohydrate <span className="admin-hint">(e.g. 6g)</span>
                <input
                  name="nfTotalCarbs"
                  defaultValue={product?.nutritionFacts?.totalCarbs ?? ''}
                  placeholder="6g"
                />
              </label>
              <label>
                Sugars <span className="admin-hint">(e.g. 5g)</span>
                <input
                  name="nfSugars"
                  defaultValue={product?.nutritionFacts?.sugars ?? ''}
                  placeholder="5g"
                />
              </label>
              <label>
                Protein <span className="admin-hint">(e.g. 0g)</span>
                <input
                  name="nfProtein"
                  defaultValue={product?.nutritionFacts?.protein ?? ''}
                  placeholder="0g"
                />
              </label>
            </>
          )}

          {/* Hidden passthrough fields — ensure FormData is consistent for all categories */}
          {!catConfig.hasFlowerProfile && !catConfig.hasDrinkAttributes && (
            <>
              <input type="hidden" name="strain" value="" />
              <input type="hidden" name="effects" value="" />
              <input type="hidden" name="flavors" value="" />
            </>
          )}
          {!catConfig.hasLabResults && (
            <>
              <input type="hidden" name="labResults_thcPercent" value="" />
              <input type="hidden" name="labResults_cbdPercent" value="" />
              <input type="hidden" name="terpenes" value="" />
              <input type="hidden" name="labResults_testDate" value="" />
              <input type="hidden" name="labResults_labName" value="" />
              <input
                type="hidden"
                name="coaUrl"
                value={product?.coaUrl ?? ''}
              />
            </>
          )}
          {!catConfig.hasVapeAttributes && (
            <>
              <input type="hidden" name="hardwareType" value="" />
              <input type="hidden" name="extractionType" value="" />
              <input type="hidden" name="volumeMl" value="" />
            </>
          )}
          {!catConfig.hasDrinkAttributes && (
            <>
              <input type="hidden" name="thcMgPerServing" value="" />
              <input type="hidden" name="cbdMgPerServing" value="" />
            </>
          )}
          {!catConfig.hasNutritionFacts && !catConfig.hasDrinkAttributes && (
            <>
              <input type="hidden" name="nfServingSize" value="" />
              <input type="hidden" name="nfServingsPerContainer" value="" />
            </>
          )}
          {!catConfig.hasNutritionFacts && (
            <>
              <input type="hidden" name="nfCalories" value="" />
              <input type="hidden" name="nfTotalFat" value="" />
              <input type="hidden" name="nfSodium" value="" />
              <input type="hidden" name="nfTotalCarbs" value="" />
              <input type="hidden" name="nfSugars" value="" />
              <input type="hidden" name="nfProtein" value="" />
            </>
          )}
        </fieldset>
      </div>

      {/* ── Step 4: Variants ──────────────────────────────────── */}
      <div
        className={
          domStep !== 4 ? 'wizard-step wizard-step--hidden' : 'wizard-step'
        }
        aria-hidden={domStep !== 4}
      >
        <fieldset className="admin-fieldset">
          <legend>Variants</legend>
          <VariantEditor
            initialGroups={product?.variantGroups ?? []}
            variantTemplates={variantTemplates}
          />
        </fieldset>
      </div>

      {/* ── Step 5: Images ─────────────────────────────────────── */}
      <div
        className={
          domStep !== 5 ? 'wizard-step wizard-step--hidden' : 'wizard-step'
        }
        aria-hidden={domStep !== 5}
      >
        <fieldset className="admin-fieldset">
          <legend>Images</legend>
          {mode === 'create' && !slug ? (
            <p className="admin-hint admin-muted">
              A slug is required before uploading images. Go back to Step 1.
            </p>
          ) : (
            <ProductImageUpload
              slug={slug || product?.slug || ''}
              initialFeaturedPath={mode === 'edit' ? product?.image : undefined}
              initialGalleryPaths={
                mode === 'edit' ? product?.images : undefined
              }
              onUploadingChange={setImageUploading}
            />
          )}
        </fieldset>
      </div>

      {/* ── Step 6: Review ───────────────────────────────────────── */}
      <div
        className={
          domStep !== 6 ? 'wizard-step wizard-step--hidden' : 'wizard-step'
        }
        aria-hidden={domStep !== 6}
      >
        {reviewSnapshot && (
          <div className="wizard-review">
            {/* Category & Name */}
            <div className="wizard-review-section">
              <div className="wizard-review-section-header">
                <p className="admin-section-title">Category &amp; Name</p>
                <button
                  type="button"
                  className="wizard-review-edit"
                  onClick={() => {
                    setReviewSnapshot(null);
                    setDomStep(1);
                  }}
                >
                  Edit
                </button>
              </div>
              <p>
                {reviewSnapshot.categoryLabel} —{' '}
                <strong>{reviewSnapshot.name}</strong>
              </p>
              <p className="admin-hint">{reviewSnapshot.slug}</p>
              {reviewSnapshot.vendorName && (
                <p className="admin-hint">
                  Vendor: {reviewSnapshot.vendorName}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="wizard-review-section">
              <div className="wizard-review-section-header">
                <p className="admin-section-title">Description</p>
                <button
                  type="button"
                  className="wizard-review-edit"
                  onClick={() => {
                    setReviewSnapshot(null);
                    setDomStep(2);
                  }}
                >
                  Edit
                </button>
              </div>
              <p className="admin-hint">
                {reviewSnapshot.details.slice(0, 120)}
                {reviewSnapshot.details.length > 120 ? '\u2026' : ''}
              </p>
            </div>

            {/* Configurator section (if applicable) */}
            {catConfig.configuratorTitle && (
              <div className="wizard-review-section">
                <div className="wizard-review-section-header">
                  <p className="admin-section-title">
                    {catConfig.configuratorTitle}
                  </p>
                  <button
                    type="button"
                    className="wizard-review-edit"
                    onClick={() => {
                      setReviewSnapshot(null);
                      setDomStep(3);
                    }}
                  >
                    Edit
                  </button>
                </div>
                <div className="admin-hint">
                  {catConfig.hasFlowerProfile && reviewSnapshot.strain && (
                    <span>Strain: {reviewSnapshot.strain} · </span>
                  )}
                  {catConfig.hasLabResults && reviewSnapshot.thcPct && (
                    <span>THC: {reviewSnapshot.thcPct}% · </span>
                  )}
                  {catConfig.hasLabResults && (
                    <span>
                      COA: {reviewSnapshot.coaUploaded ? 'Uploaded' : 'None'}{' '}
                      ·{' '}
                    </span>
                  )}
                  {catConfig.hasVapeAttributes &&
                    reviewSnapshot.hardwareType && (
                      <span>{reviewSnapshot.hardwareType} · </span>
                    )}
                  {catConfig.hasVapeAttributes &&
                    reviewSnapshot.extractionType && (
                      <span>{reviewSnapshot.extractionType}</span>
                    )}
                  {catConfig.hasDrinkAttributes &&
                    reviewSnapshot.thcMgPerServing && (
                      <span>
                        {reviewSnapshot.thcMgPerServing}mg THC/serving
                      </span>
                    )}
                  {catConfig.hasNutritionFacts &&
                    reviewSnapshot.servingSize && (
                      <span>Serving: {reviewSnapshot.servingSize}</span>
                    )}
                </div>
              </div>
            )}

            {/* Variants */}
            <div className="wizard-review-section">
              <div className="wizard-review-section-header">
                <p className="admin-section-title">Variants</p>
                <button
                  type="button"
                  className="wizard-review-edit"
                  onClick={() => {
                    setReviewSnapshot(null);
                    setDomStep(4);
                  }}
                >
                  Edit
                </button>
              </div>
              <p className="admin-hint">
                {reviewSnapshot.variantCount > 0
                  ? `${reviewSnapshot.variantCount} variant${reviewSnapshot.variantCount !== 1 ? 's' : ''} defined`
                  : 'No variants \u2014 pricing set in Inventory'}
              </p>
            </div>

            {/* Images */}
            <div className="wizard-review-section">
              <div className="wizard-review-section-header">
                <p className="admin-section-title">Images</p>
                <button
                  type="button"
                  className="wizard-review-edit"
                  onClick={() => {
                    setReviewSnapshot(null);
                    setDomStep(5);
                  }}
                >
                  Edit
                </button>
              </div>
              <p className="admin-hint">
                {reviewSnapshot.hasFeaturedImage
                  ? 'Featured image uploaded'
                  : 'No featured image \u2014 can be added after creation'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation ─────────────────────────────────────────── */}
      <div className="wizard-nav admin-form-actions">
        {seqIndex === 0 ? (
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
            {imageUploading ? 'Uploading image…' : submitLabel}
          </button>
        )}
      </div>
    </form>
  );
}
