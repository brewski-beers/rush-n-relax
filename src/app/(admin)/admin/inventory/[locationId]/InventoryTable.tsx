'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { updateInventoryItem } from './actions';
import { formatCents } from '@/utils/currency';
import type { ProductSummary } from '@/types';

export interface InventoryRow extends ProductSummary {
  quantity: number;
  inStock: boolean;
  availableOnline: boolean;
  availablePickup: boolean;
  featured: boolean;
}

interface Props {
  rows: InventoryRow[];
  locationId: string;
  isHub: boolean;
  /** Whether the current user is an owner — gates cost and markup columns */
  isOwner: boolean;
}

export default function InventoryTable({
  rows,
  locationId,
  isHub,
  isOwner,
}: Props) {
  // base: 6 cols + 1 retail price + (2 owner-only: cost, markup) + edit link
  const baseCols = isHub ? 6 : 6;
  const pricingCols = 1 + (isOwner ? 2 : 0) + 1; // retail price + (cost + markup) + edit link
  const colSpan = baseCols + pricingCols;

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Category</th>
            <th className="admin-col-qty">Quantity</th>
            <th className="admin-col-toggle">In Stock</th>
            {isHub && <th className="admin-col-toggle">Available Online</th>}
            {!isHub && <th className="admin-col-toggle">Available Pickup</th>}
            <th className="admin-col-toggle">Featured</th>
            <th>Retail Price</th>
            {isOwner && <th>Cost</th>}
            {isOwner && <th>Markup %</th>}
            <th>Pricing</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <InventoryRowItem
              key={`${row.id}:${row.quantity}:${row.inStock}:${row.availableOnline}:${row.featured}`}
              row={row}
              locationId={locationId}
              isHub={isHub}
              isOwner={isOwner}
            />
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={colSpan} className="admin-empty">
                No products found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function InventoryRowItem({
  row,
  locationId,
  isHub,
  isOwner,
}: {
  row: InventoryRow;
  locationId: string;
  isHub: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [quantityInput, setQuantityInput] = useState(String(row.quantity));
  const [availableOnline, setAvailableOnline] = useState(row.availableOnline);
  const [availablePickup, setAvailablePickup] = useState(row.availablePickup);
  const [featured, setFeatured] = useState(row.featured);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const quantity = normalizeQuantityInput(quantityInput);
  const inStock = quantity > 0;

  // Hub: featured requires availableOnline; retail: featured requires inStock
  const featuredEnabled = isHub ? availableOnline : inStock;

  function handleToggle(
    field: 'inStock' | 'availableOnline' | 'availablePickup' | 'featured',
    value: boolean
  ) {
    setUpdateError(null);
    const previous = {
      quantityInput,
      availableOnline,
      availablePickup,
      featured,
    };

    if (field === 'inStock') {
      const nextQuantity = value ? Math.max(quantity, 1) : 0;
      setQuantityInput(String(nextQuantity));
      if (!value) {
        setAvailableOnline(false);
        setAvailablePickup(false);
        setFeatured(false);
      }
    } else if (field === 'availableOnline') {
      setAvailableOnline(value);
      if (!value) setFeatured(false);
    } else if (field === 'availablePickup') {
      setAvailablePickup(value);
    } else {
      setFeatured(value);
    }

    const nextPatch: {
      inStock?: boolean;
      quantity?: number;
      availableOnline?: boolean;
      availablePickup?: boolean;
      featured?: boolean;
    } =
      field === 'inStock'
        ? {
            quantity: value ? Math.max(quantity, 1) : 0,
            ...(value
              ? {}
              : {
                  availableOnline: false,
                  availablePickup: false,
                  featured: false,
                }),
          }
        : field === 'availableOnline'
          ? { availableOnline: value, ...(!value ? { featured: false } : {}) }
          : field === 'availablePickup'
            ? { availablePickup: value }
            : { featured: value };

    startTransition(async () => {
      try {
        await updateInventoryItem(locationId, row.id, nextPatch);
        setUpdateError(null);
        router.refresh();
      } catch {
        setQuantityInput(previous.quantityInput);
        setAvailableOnline(previous.availableOnline);
        setAvailablePickup(previous.availablePickup);
        setFeatured(previous.featured);
        setUpdateError('Failed to update. Please try again.');
      }
    });
  }

  function handleQuantityInput(value: string) {
    if (/^\d*$/.test(value)) {
      setQuantityInput(value);
      if (normalizeQuantityInput(value) === 0) {
        setAvailableOnline(false);
        setFeatured(false);
      }
    }
  }

  function commitQuantity() {
    setUpdateError(null);
    const previous = { quantityInput, availableOnline, featured };
    const nextQuantity = normalizeQuantityInput(quantityInput);
    const nextAvailableOnline = nextQuantity > 0 ? availableOnline : false;
    const nextFeatured =
      nextQuantity > 0
        ? isHub
          ? nextAvailableOnline && featured
          : featured
        : false;

    setQuantityInput(String(nextQuantity));
    setAvailableOnline(nextAvailableOnline);
    setFeatured(nextFeatured);

    startTransition(async () => {
      try {
        await updateInventoryItem(locationId, row.id, {
          quantity: nextQuantity,
          ...(nextAvailableOnline !== availableOnline
            ? { availableOnline: nextAvailableOnline }
            : {}),
          ...(nextFeatured !== featured ? { featured: nextFeatured } : {}),
        });
        setUpdateError(null);
        router.refresh();
      } catch {
        setQuantityInput(previous.quantityInput);
        setAvailableOnline(previous.availableOnline);
        setFeatured(previous.featured);
        setUpdateError('Failed to update. Please try again.');
      }
    });
  }

  const pricing = row.pricing;
  const markupDisplay =
    isOwner && pricing?.cost != null && pricing.cost > 0
      ? `${Math.round(((pricing.price - pricing.cost) / pricing.cost) * 100)}%`
      : '—';

  return (
    <tr className={isPending ? 'admin-row-pending' : undefined}>
      <td>
        {row.name}
        {updateError && (
          <span className="admin-inline-error">{updateError}</span>
        )}
      </td>
      <td>{row.category}</td>
      <td className="admin-qty-cell">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className="admin-qty-input"
          value={quantityInput}
          disabled={isPending}
          onChange={e => handleQuantityInput(e.target.value)}
          onBlur={commitQuantity}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitQuantity();
            }
          }}
          aria-label={`Quantity for ${row.name}`}
        />
      </td>
      <td className="admin-col-toggle">
        <input
          type="checkbox"
          className="admin-toggle"
          checked={inStock}
          disabled={isPending}
          onChange={e => handleToggle('inStock', e.target.checked)}
          aria-label={`In stock for ${row.name}`}
        />
      </td>
      {isHub && (
        <td className="admin-col-toggle">
          <input
            type="checkbox"
            className="admin-toggle"
            checked={availableOnline}
            disabled={isPending || !inStock}
            onChange={e => handleToggle('availableOnline', e.target.checked)}
            aria-label={`Available online for ${row.name}`}
          />
        </td>
      )}
      {!isHub && (
        <td className="admin-col-toggle">
          <input
            type="checkbox"
            className="admin-toggle"
            checked={availablePickup}
            disabled={isPending || !inStock}
            onChange={e => handleToggle('availablePickup', e.target.checked)}
            aria-label={`Available pickup for ${row.name}`}
          />
        </td>
      )}
      <td className="admin-col-toggle">
        <input
          type="checkbox"
          className="admin-toggle"
          checked={featured}
          disabled={isPending || !featuredEnabled}
          onChange={e => handleToggle('featured', e.target.checked)}
          aria-label={`Featured for ${row.name}`}
        />
      </td>
      {/* Pricing columns — read-only */}
      <td>{pricing ? formatCents(pricing.price) : '—'}</td>
      {isOwner && (
        <td>{pricing?.cost != null ? formatCents(pricing.cost) : '—'}</td>
      )}
      {isOwner && <td>{markupDisplay}</td>}
      <td>
        <Link
          href={`/admin/products/${row.slug}/edit`}
          className="admin-link"
          aria-label={`Edit pricing for ${row.name}`}
        >
          Edit pricing
        </Link>
      </td>
    </tr>
  );
}

function normalizeQuantityInput(value: string): number {
  if (!value.trim()) return 0;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, parsed);
}
