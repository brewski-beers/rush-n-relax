'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateInventoryItem } from './actions';
import type { ProductSummary } from '@/types';

export interface InventoryRow extends ProductSummary {
  quantity: number;
  inStock: boolean;
  availableOnline: boolean;
}

interface Props {
  rows: InventoryRow[];
  locationId: string;
  isHub: boolean;
}

export default function InventoryTable({ rows, locationId, isHub }: Props) {
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
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <InventoryRow
              key={`${row.id}:${row.quantity}:${row.availableOnline}`}
              row={row}
              locationId={locationId}
              isHub={isHub}
            />
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={isHub ? 5 : 4} className="admin-empty">
                No products found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function InventoryRow({
  row,
  locationId,
  isHub,
}: {
  row: InventoryRow;
  locationId: string;
  isHub: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [quantityInput, setQuantityInput] = useState(String(row.quantity));
  const [availableOnline, setAvailableOnline] = useState(row.availableOnline);

  const quantity = normalizeQuantityInput(quantityInput);
  const inStock = quantity > 0;

  function handleToggle(field: 'inStock' | 'availableOnline', value: boolean) {
    const previous = { quantityInput, availableOnline };

    if (field === 'inStock') {
      const nextQuantity = value ? Math.max(quantity, 1) : 0;
      setQuantityInput(String(nextQuantity));
      if (!value) setAvailableOnline(false);
    } else {
      setAvailableOnline(value);
    }

    const nextPatch =
      field === 'inStock'
        ? {
            quantity: value ? Math.max(quantity, 1) : 0,
            ...(value ? {} : { availableOnline: false }),
          }
        : { availableOnline: value };

    startTransition(async () => {
      try {
        await updateInventoryItem(locationId, row.id, nextPatch);
        router.refresh();
      } catch {
        setQuantityInput(previous.quantityInput);
        setAvailableOnline(previous.availableOnline);
      }
    });
  }

  function handleQuantityInput(value: string) {
    if (/^\d*$/.test(value)) {
      setQuantityInput(value);
      if (normalizeQuantityInput(value) === 0) {
        setAvailableOnline(false);
      }
    }
  }

  function commitQuantity() {
    const previous = { quantityInput, availableOnline };
    const nextQuantity = normalizeQuantityInput(quantityInput);
    const nextAvailableOnline = nextQuantity > 0 ? availableOnline : false;

    setQuantityInput(String(nextQuantity));
    setAvailableOnline(nextAvailableOnline);

    startTransition(async () => {
      try {
        await updateInventoryItem(locationId, row.id, {
          quantity: nextQuantity,
          ...(nextAvailableOnline === availableOnline
            ? {}
            : { availableOnline: nextAvailableOnline }),
        });
        router.refresh();
      } catch {
        setQuantityInput(previous.quantityInput);
        setAvailableOnline(previous.availableOnline);
      }
    });
  }

  return (
    <tr className={isPending ? 'admin-row-pending' : undefined}>
      <td>{row.name}</td>
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
    </tr>
  );
}

function normalizeQuantityInput(value: string): number {
  if (!value.trim()) return 0;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, parsed);
}
