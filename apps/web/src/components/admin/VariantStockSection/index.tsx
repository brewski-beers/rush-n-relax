'use client';

/**
 * Issue #311 — folds inventory editing into the product editor. Renders one
 * sub-section per variant (label) with one row per location (qty / price /
 * availablePickup / featured). Calls `setProductVariantStock` per row.
 *
 * KISS: each row owns its own dirty state + transition. No global form
 * state — saves are independent per row so a failure on one location
 * doesn't block another.
 */

import { useState, useTransition } from 'react';
import type {
  Product,
  ProductVariant,
  ProductVariantLocation,
  LocationSummary,
} from '@/types';
import { setProductVariantStock } from '@/app/(admin)/admin/products/[slug]/edit/stock-actions';

interface Props {
  product: Product;
  locations: LocationSummary[];
  /** Online-store synthetic location ID. */
  onlineLocationId: string;
}

export function VariantStockSection({
  product,
  locations,
  onlineLocationId,
}: Props) {
  const variants = product.variants ?? {};
  const isEmpty = Object.keys(variants).length === 0;

  const allLocations: { id: string; label: string; isOnline: boolean }[] = [
    ...locations.map(l => ({ id: l.id, label: l.name, isOnline: false })),
    { id: onlineLocationId, label: 'Online Store', isOnline: true },
  ];

  return (
    <fieldset className="admin-fieldset">
      <legend>Variants &amp; Stock</legend>
      <p className="admin-section-desc">
        Edit per-location stock, price, pickup eligibility, and featured state
        for each variant. Variant labels are managed in the Variants section
        above.
      </p>
      {isEmpty ? (
        <p className="admin-hint" role="status">
          No variants on this product yet. Add a variant in the Variants section
          above and save — stock controls will populate here.
        </p>
      ) : (
        Object.entries(variants).map(([variantId, spec]) => (
          <VariantBlock
            key={variantId}
            slug={product.slug}
            variantId={variantId}
            spec={spec}
            locations={allLocations}
          />
        ))
      )}
    </fieldset>
  );
}

interface VariantBlockProps {
  slug: string;
  variantId: string;
  spec: ProductVariant;
  locations: { id: string; label: string; isOnline: boolean }[];
}

function VariantBlock({ slug, variantId, spec, locations }: VariantBlockProps) {
  return (
    <div className="admin-variant-stock-block">
      <h3 className="admin-section-title">{spec.label}</h3>
      <table className="admin-variant-stock-table">
        <thead>
          <tr>
            <th>Location</th>
            <th>Qty</th>
            <th>Price (¢)</th>
            <th>Pickup</th>
            <th>Featured</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {locations.map(loc => (
            <LocationRow
              key={loc.id}
              slug={slug}
              variantId={variantId}
              locationId={loc.id}
              locationLabel={loc.label}
              isOnline={loc.isOnline}
              existing={spec.locations[loc.id]}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface LocationRowProps {
  slug: string;
  variantId: string;
  locationId: string;
  locationLabel: string;
  isOnline: boolean;
  existing: ProductVariantLocation | undefined;
}

function LocationRow({
  slug,
  variantId,
  locationId,
  locationLabel,
  isOnline,
  existing,
}: LocationRowProps) {
  const [qty, setQty] = useState(String(existing?.qty ?? 0));
  const [price, setPrice] = useState(String(existing?.price ?? 0));
  const [availablePickup, setAvailablePickup] = useState(
    existing?.availablePickup ?? false
  );
  const [featured, setFeatured] = useState(existing?.featured ?? false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const onSave = () => {
    setError(null);
    setSavedAt(null);
    const qtyNum = Number(qty);
    const priceNum = Number(price);
    if (!Number.isFinite(qtyNum) || !Number.isFinite(priceNum)) {
      setError('Qty and price must be numbers.');
      return;
    }
    startTransition(async () => {
      const result = await setProductVariantStock(slug, variantId, locationId, {
        qty: qtyNum,
        price: priceNum,
        ...(isOnline ? {} : { availablePickup }),
        featured,
      });
      if (!result.ok) {
        setError(result.error);
      } else {
        setSavedAt(Date.now());
      }
    });
  };

  return (
    <tr>
      <td>{locationLabel}</td>
      <td>
        <input
          type="number"
          min="0"
          step="1"
          value={qty}
          onChange={e => setQty(e.target.value)}
          aria-label={`${locationLabel} quantity`}
          disabled={pending}
        />
      </td>
      <td>
        <input
          type="number"
          min="0"
          step="1"
          value={price}
          onChange={e => setPrice(e.target.value)}
          aria-label={`${locationLabel} price in cents`}
          disabled={pending}
        />
      </td>
      <td>
        {isOnline ? (
          <span className="admin-input-readonly">—</span>
        ) : (
          <input
            type="checkbox"
            checked={availablePickup}
            onChange={e => setAvailablePickup(e.target.checked)}
            aria-label={`${locationLabel} available for pickup`}
            disabled={pending}
          />
        )}
      </td>
      <td>
        <input
          type="checkbox"
          checked={featured}
          onChange={e => setFeatured(e.target.checked)}
          aria-label={`${locationLabel} featured`}
          disabled={pending}
        />
      </td>
      <td>
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="admin-btn-secondary"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        {error && (
          <span className="admin-error" role="alert">
            {error}
          </span>
        )}
        {savedAt && !error && (
          <span className="admin-hint" role="status">
            Saved
          </span>
        )}
      </td>
    </tr>
  );
}
