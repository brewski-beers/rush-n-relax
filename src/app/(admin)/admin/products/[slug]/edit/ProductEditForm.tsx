'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import Link from 'next/link';
import { updateProduct } from './actions';
import { ProductImageUpload } from '@/components/admin/ProductImageUpload';
import type {
  Product,
  LocationSummary,
  ProductCategorySummary,
  VendorSummary,
} from '@/types';

interface Props {
  product: Product;
  locations: LocationSummary[];
  categories: ProductCategorySummary[];
  vendors: VendorSummary[];
  isOwner?: boolean;
}

const TOTAL_STEPS = 6;

export function ProductEditForm({
  product,
  locations,
  categories,
  vendors,
  isOwner = true,
}: Props) {
  const boundAction = updateProduct.bind(null, product.slug);
  const [state, formAction, pending] = useActionState(boundAction, null);
  const [step, setStep] = useState(1);

  // Step 1 — Vendor
  const [vendorSlug, setVendorSlug] = useState(product.vendorSlug ?? '');
  // Step 2 — Category & Name
  const [category, setCategory] = useState(product.category);
  const [name, setName] = useState(product.name);
  // Step 3 — Description
  const [leaflyUrl, setLeaflyUrl] = useState(product.leaflyUrl ?? '');
  const [description, setDescription] = useState(product.description);
  const [details, setDetails] = useState(product.details);
  // Step 4 — Lab Results
  const [thcPct, setThcPct] = useState(
    product.labResults?.thcPct?.toString() ?? ''
  );
  const [cbdPct, setCbdPct] = useState(
    product.labResults?.cbdPct?.toString() ?? ''
  );
  const [terpenes, setTerpenes] = useState(
    product.labResults?.terpenes?.join(', ') ?? ''
  );
  const [testDate, setTestDate] = useState(
    product.labResults?.testDate
      ? product.labResults.testDate.toISOString().slice(0, 10)
      : ''
  );
  const [labName, setLabName] = useState(product.labResults?.labName ?? '');
  // Step 5 — Availability & Compliance
  const [availableAt, setAvailableAt] = useState<string[]>(product.availableAt);
  const [federalDeadlineRisk, setFederalDeadlineRisk] = useState(
    product.federalDeadlineRisk
  );
  const [status, setStatus] = useState(product.status);

  const selectedVendor = vendors.find(v => v.slug === vendorSlug);

  function advance() {
    setStep(s => Math.min(s + 1, TOTAL_STEPS));
  }

  function back() {
    setStep(s => Math.max(s - 1, 1));
  }

  function toggleLocation(locSlug: string) {
    setAvailableAt(prev =>
      prev.includes(locSlug)
        ? prev.filter(s => s !== locSlug)
        : [...prev, locSlug]
    );
  }

  const stepValid: Record<number, boolean> = {
    1: true, // vendor is optional on edit
    2: category !== '' && name.trim() !== '',
    3: description.trim() !== '' && details.trim() !== '',
    4: true,
    5: true,
    6: true,
  };

  return (
    <div className="admin-wizard">
      <p className="admin-wizard-step">
        Step {step} of {TOTAL_STEPS}
      </p>

      <form action={formAction} className="admin-form">
        {state?.error && <p className="admin-error">{state.error}</p>}

        {/* Hidden fields */}
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="vendorSlug" value={vendorSlug} />
        <input type="hidden" name="description" value={description} />
        <input type="hidden" name="details" value={details} />
        <input type="hidden" name="leaflyUrl" value={leaflyUrl} />
        <input type="hidden" name="thcPct" value={thcPct} />
        <input type="hidden" name="cbdPct" value={cbdPct} />
        <input type="hidden" name="terpenes" value={terpenes} />
        <input type="hidden" name="testDate" value={testDate} />
        <input type="hidden" name="labName" value={labName} />
        <input
          type="hidden"
          name="federalDeadlineRisk"
          value={federalDeadlineRisk ? 'true' : ''}
        />
        <input type="hidden" name="status" value={status} />
        {availableAt.map(loc => (
          <input key={loc} type="hidden" name="availableAt" value={loc} />
        ))}

        {/* ── Step 1: Vendor ─────────────────────────────────────────────── */}
        {step === 1 && (
          <fieldset className="admin-fieldset">
            <legend>Step 1 — Vendor</legend>
            <label>
              Vendor <span className="admin-hint">(optional)</span>
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
                Description source:{' '}
                <strong>{selectedVendor.descriptionSource}</strong>
              </p>
            )}
          </fieldset>
        )}

        {/* ── Step 2: Category & Name ────────────────────────────────────── */}
        {step === 2 && (
          <fieldset className="admin-fieldset">
            <legend>Step 2 — Category &amp; Name</legend>
            <label>
              Category
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                required
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
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </label>
            <label>
              Slug <span className="admin-hint">(cannot be changed)</span>
              <input
                value={product.slug}
                disabled
                className="admin-input-readonly"
                readOnly
              />
            </label>
          </fieldset>
        )}

        {/* ── Step 3: Description ────────────────────────────────────────── */}
        {step === 3 && (
          <fieldset className="admin-fieldset">
            <legend>Step 3 — Description</legend>
            {selectedVendor?.descriptionSource === 'leafly' && (
              <label>
                Leafly URL{' '}
                <span className="admin-hint">(optional — for reference)</span>
                <input
                  type="url"
                  value={leaflyUrl}
                  onChange={e => setLeaflyUrl(e.target.value)}
                  placeholder="https://www.leafly.com/…"
                />
              </label>
            )}
            <label>
              Description
              <textarea
                rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
                required
              />
            </label>
            <label>
              Details
              <textarea
                rows={5}
                value={details}
                onChange={e => setDetails(e.target.value)}
                required
              />
            </label>
          </fieldset>
        )}

        {/* ── Step 4: Lab Results ────────────────────────────────────────── */}
        {step === 4 && (
          <fieldset className="admin-fieldset">
            <legend>Step 4 — Lab Results</legend>
            <span className="admin-hint">
              All fields optional.
              {product.coaUrl && (
                <>
                  {' '}
                  CoA on file:{' '}
                  <a
                    href={product.coaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View
                  </a>
                </>
              )}
            </span>
            <label>
              THC %
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={thcPct}
                onChange={e => setThcPct(e.target.value)}
              />
            </label>
            <label>
              CBD %
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={cbdPct}
                onChange={e => setCbdPct(e.target.value)}
              />
            </label>
            <label>
              Terpenes <span className="admin-hint">(comma-separated)</span>
              <input
                value={terpenes}
                onChange={e => setTerpenes(e.target.value)}
                placeholder="Myrcene, Limonene, Caryophyllene"
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
                placeholder="ProVerde Laboratories"
              />
            </label>
          </fieldset>
        )}

        {/* ── Step 5: Availability & Compliance ─────────────────────────── */}
        {step === 5 && (
          <fieldset className="admin-fieldset">
            <legend>Step 5 — Availability &amp; Compliance</legend>
            <fieldset className="admin-fieldset">
              <legend>Available At</legend>
              {locations.map(loc => (
                <label key={loc.slug} className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={availableAt.includes(loc.slug)}
                    onChange={() => toggleLocation(loc.slug)}
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
                (≤0.4mg total THC — affected by Nov 2026 rule)
              </span>
            </label>
            {isOwner && (
              <label>
                Status
                {product.status === 'compliance-hold' ? (
                  <>
                    <input
                      value="compliance-hold"
                      disabled
                      className="admin-input-readonly"
                      readOnly
                    />
                    <span className="admin-hint">
                      Set by compliance system — cannot be changed here.
                    </span>
                  </>
                ) : (
                  <select
                    value={status}
                    onChange={e =>
                      setStatus(e.target.value as Product['status'])
                    }
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
          </fieldset>
        )}

        {/* ── Step 6: Images ────────────────────────────────────────────── */}
        {step === 6 && (
          <fieldset className="admin-fieldset">
            <legend>Step 6 — Images</legend>
            <ProductImageUpload
              slug={product.slug}
              initialFeaturedPath={product.image}
              initialGalleryPaths={product.images}
            />
          </fieldset>
        )}

        {/* ── Navigation ────────────────────────────────────────────────── */}
        <div className="admin-form-actions">
          {step === 1 ? (
            <Link href="/admin/products">Cancel</Link>
          ) : (
            <button type="button" onClick={back}>
              Back
            </button>
          )}

          {step < TOTAL_STEPS ? (
            <button type="button" onClick={advance} disabled={!stepValid[step]}>
              Next
            </button>
          ) : (
            <button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
