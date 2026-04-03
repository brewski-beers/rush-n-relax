'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import Link from 'next/link';
import { updateProduct } from './actions';
import { ProductImageUpload } from '@/components/admin/ProductImageUpload';
import type { Product, LocationSummary, ProductCategorySummary } from '@/types';
import type { VendorSummary } from '@/types/vendor';

interface Props {
  product: Product;
  locations: LocationSummary[];
  categories: ProductCategorySummary[];
  vendors: VendorSummary[];
  isOwner: boolean;
}

const TOTAL_STEPS = 6;

const DESCRIPTION_SOURCE_HINTS: Record<string, string> = {
  leafly:
    'Paste the Leafly URL and copy the description from the product page.',
  'vendor-provided': 'Use the description provided by the vendor.',
  custom: 'Write a custom description for this product.',
};

export function ProductEditForm({
  product,
  locations,
  categories,
  vendors,
  isOwner,
}: Props) {
  const boundAction = updateProduct.bind(null, product.slug);
  const [state, formAction, pending] = useActionState(boundAction, null);

  const [step, setStep] = useState(1);

  // Step 1 — Vendor
  const [vendorSlug, setVendorSlug] = useState(product.vendorSlug ?? '');

  // Step 2 — Category & Name
  const [name, setName] = useState(product.name);
  const [category, setCategory] = useState(product.category);

  // Step 3 — Description
  const [description, setDescription] = useState(product.description);
  const [details, setDetails] = useState(product.details);
  const [leaflyUrl, setLeaflyUrl] = useState(product.leaflyUrl ?? '');

  // Step 4 — Lab Results
  const [thcPercent, setThcPercent] = useState(
    product.labResults?.thcPercent?.toString() ?? ''
  );
  const [cbdPercent, setCbdPercent] = useState(
    product.labResults?.cbdPercent?.toString() ?? ''
  );
  const [terpenes, setTerpenes] = useState(
    product.labResults?.terpenes?.join(', ') ?? ''
  );
  const [testDate, setTestDate] = useState(product.labResults?.testDate ?? '');
  const [labName, setLabName] = useState(product.labResults?.labName ?? '');

  // Step 5 — Availability & Compliance
  const [availableAt, setAvailableAt] = useState<string[]>(product.availableAt);
  const [federalDeadlineRisk, setFederalDeadlineRisk] = useState(
    product.federalDeadlineRisk
  );
  const [status, setStatus] = useState(product.status);

  const [stepErrors, setStepErrors] = useState<Record<number, string>>({});

  function validateStep(s: number): string | null {
    switch (s) {
      case 2:
        if (!name.trim()) return 'Name is required.';
        if (!category) return 'Category is required.';
        return null;
      case 3:
        if (!description.trim()) return 'Description is required.';
        if (!details.trim()) return 'Details are required.';
        return null;
      default:
        return null;
    }
  }

  function advance() {
    const err = validateStep(step);
    if (err) {
      setStepErrors(prev => ({ ...prev, [step]: err }));
      return;
    }
    setStepErrors(prev => ({ ...prev, [step]: '' }));
    setStep(s => s + 1);
  }

  function back() {
    setStep(s => s - 1);
  }

  function toggleAvailableAt(locationSlug: string, checked: boolean) {
    setAvailableAt(prev =>
      checked ? [...prev, locationSlug] : prev.filter(s => s !== locationSlug)
    );
  }

  const selectedVendor = vendors.find(v => v.slug === vendorSlug);
  const showLeaflyField = selectedVendor?.descriptionSource === 'leafly';

  const isComplianceHold = product.status === 'compliance-hold';

  return (
    <div className="admin-wizard">
      <p className="admin-wizard-step-indicator" aria-live="polite">
        Step {step} of {TOTAL_STEPS}
      </p>

      {state?.error && <p className="admin-error">{state.error}</p>}

      <form action={formAction} className="admin-form">
        {/* Hidden fields carry all state on submit */}
        <input type="hidden" name="vendorSlug" value={vendorSlug} />
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="description" value={description} />
        <input type="hidden" name="details" value={details} />
        {showLeaflyField && (
          <input type="hidden" name="leaflyUrl" value={leaflyUrl} />
        )}
        {thcPercent && (
          <input type="hidden" name="labThcPercent" value={thcPercent} />
        )}
        {cbdPercent && (
          <input type="hidden" name="labCbdPercent" value={cbdPercent} />
        )}
        {terpenes && (
          <input type="hidden" name="labTerpenes" value={terpenes} />
        )}
        {testDate && (
          <input type="hidden" name="labTestDate" value={testDate} />
        )}
        {labName && <input type="hidden" name="labLabName" value={labName} />}
        {availableAt.map(loc => (
          <input key={loc} type="hidden" name="availableAt" value={loc} />
        ))}
        <input
          type="hidden"
          name="federalDeadlineRisk"
          value={federalDeadlineRisk ? 'true' : 'false'}
        />
        {/* Status: compliance-hold is system-managed and cannot be changed */}
        {isComplianceHold ? (
          <input type="hidden" name="status" value="compliance-hold" />
        ) : (
          <input type="hidden" name="status" value={status} />
        )}
        {/* Preserve coaUrl if set — not editable in this form */}
        {product.coaUrl && (
          <input type="hidden" name="coaUrl" value={product.coaUrl} />
        )}

        {/* Step 1: Vendor */}
        {step === 1 && (
          <div className="admin-wizard-step">
            <h2 className="admin-wizard-step-title">Step 1 &#8212; Vendor</h2>
            {stepErrors[1] && <p className="admin-error">{stepErrors[1]}</p>}
            <label>
              Vendor
              <select
                value={vendorSlug}
                onChange={e => setVendorSlug(e.target.value)}
              >
                <option value="">No vendor selected</option>
                {vendors.map(v => (
                  <option key={v.slug} value={v.slug}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            {selectedVendor && (
              <p className="admin-hint">
                {DESCRIPTION_SOURCE_HINTS[selectedVendor.descriptionSource]}
              </p>
            )}
          </div>
        )}

        {/* Step 2: Category & Name */}
        {step === 2 && (
          <div className="admin-wizard-step">
            <h2 className="admin-wizard-step-title">
              Step 2 &#8212; Category &amp; Name
            </h2>
            {stepErrors[2] && <p className="admin-error">{stepErrors[2]}</p>}
            <label>
              Category
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
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
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Blue Dream"
              />
            </label>
            <p className="admin-hint">
              Slug: <code>{product.slug}</code> (cannot be changed after
              creation)
            </p>
          </div>
        )}

        {/* Step 3: Description */}
        {step === 3 && (
          <div className="admin-wizard-step">
            <h2 className="admin-wizard-step-title">
              Step 3 &#8212; Description
            </h2>
            {stepErrors[3] && <p className="admin-error">{stepErrors[3]}</p>}
            {showLeaflyField && (
              <label>
                Leafly URL
                <input
                  type="url"
                  value={leaflyUrl}
                  onChange={e => setLeaflyUrl(e.target.value)}
                  placeholder="https://www.leafly.com/strains/blue-dream"
                />
              </label>
            )}
            <label>
              Description
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
              />
            </label>
            <label>
              Details
              <textarea
                value={details}
                onChange={e => setDetails(e.target.value)}
                rows={5}
              />
            </label>
          </div>
        )}

        {/* Step 4: Lab Results */}
        {step === 4 && (
          <div className="admin-wizard-step">
            <h2 className="admin-wizard-step-title">
              Step 4 &#8212; Lab Results
            </h2>
            <p className="admin-hint">All lab result fields are optional.</p>
            {product.coaUrl && (
              <p className="admin-hint">
                COA on file:{' '}
                <a
                  href={product.coaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View
                </a>
              </p>
            )}
            <label>
              THC %
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={thcPercent}
                onChange={e => setThcPercent(e.target.value)}
                placeholder="22.5"
              />
            </label>
            <label>
              CBD %
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={cbdPercent}
                onChange={e => setCbdPercent(e.target.value)}
                placeholder="0.1"
              />
            </label>
            <label>
              Terpenes <span className="admin-hint">(comma-separated)</span>
              <input
                value={terpenes}
                onChange={e => setTerpenes(e.target.value)}
                placeholder="Myrcene, Caryophyllene, Limonene"
              />
            </label>
            <label>
              Test Date
              <input
                type="date"
                value={testDate}
                onChange={e => setTestDate(e.target.value)}
              />
            </label>
            <label>
              Lab Name
              <input
                value={labName}
                onChange={e => setLabName(e.target.value)}
                placeholder="Steep Hill Labs"
              />
            </label>
          </div>
        )}

        {/* Step 5: Availability & Compliance */}
        {step === 5 && (
          <div className="admin-wizard-step">
            <h2 className="admin-wizard-step-title">
              Step 5 &#8212; Availability &amp; Compliance
            </h2>
            <fieldset className="admin-fieldset">
              <legend>Available At</legend>
              {locations.map(loc => (
                <label key={loc.slug} className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={availableAt.includes(loc.slug)}
                    onChange={e =>
                      toggleAvailableAt(loc.slug, e.target.checked)
                    }
                  />
                  {loc.name}
                </label>
              ))}
            </fieldset>
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={federalDeadlineRisk}
                onChange={e => setFederalDeadlineRisk(e.target.checked)}
              />
              Federal deadline risk{' '}
              <span className="admin-hint">
                (&#8804;0.4mg total THC &#8212; affected by Nov 2026 rule)
              </span>
            </label>
            {/* Status — owner only; compliance-hold is system-managed */}
            {isOwner && (
              <label>
                Status
                {isComplianceHold ? (
                  <>
                    <input
                      value="compliance-hold"
                      disabled
                      className="admin-input-readonly"
                    />
                    <span className="admin-hint">
                      Set by compliance system &#8212; cannot be changed here.
                    </span>
                  </>
                ) : (
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as typeof status)}
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
          </div>
        )}

        {/* Step 6: Images */}
        {step === 6 && (
          <div className="admin-wizard-step">
            <h2 className="admin-wizard-step-title">Step 6 &#8212; Images</h2>
            <ProductImageUpload
              slug={product.slug}
              initialFeaturedPath={product.image}
              initialGalleryPaths={product.images}
            />
          </div>
        )}

        {/* Navigation */}
        <div className="admin-form-actions">
          {step === 1 ? (
            <Link href="/admin/products">Cancel</Link>
          ) : (
            <button type="button" onClick={back}>
              Back
            </button>
          )}

          {step < TOTAL_STEPS ? (
            <button type="button" onClick={advance}>
              Next
            </button>
          ) : (
            <button type="submit" disabled={pending}>
              {pending ? 'Saving\u2026' : 'Save'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
