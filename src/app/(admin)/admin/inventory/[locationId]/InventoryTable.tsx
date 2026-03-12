'use client';

import { useTransition } from 'react';
import { updateInventoryItem } from './actions';
import type { ProductSummary } from '@/types';

export interface InventoryRow extends ProductSummary {
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
    <table className="admin-table">
      <thead>
        <tr>
          <th>Product</th>
          <th>Category</th>
          <th className="admin-col-toggle">In Stock</th>
          {isHub && <th className="admin-col-toggle">Available Online</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <InventoryRow
            key={row.id}
            row={row}
            locationId={locationId}
            isHub={isHub}
          />
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={isHub ? 4 : 3} className="admin-empty">
              No products found.
            </td>
          </tr>
        )}
      </tbody>
    </table>
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
  const [isPending, startTransition] = useTransition();

  function handleToggle(field: 'inStock' | 'availableOnline', value: boolean) {
    startTransition(async () => {
      await updateInventoryItem(locationId, row.id, { [field]: value });
    });
  }

  return (
    <tr className={isPending ? 'admin-row-pending' : undefined}>
      <td>{row.name}</td>
      <td>{row.category}</td>
      <td className="admin-col-toggle">
        <input
          type="checkbox"
          className="admin-toggle"
          checked={row.inStock}
          disabled={isPending}
          onChange={e => handleToggle('inStock', e.target.checked)}
        />
      </td>
      {isHub && (
        <td className="admin-col-toggle">
          <input
            type="checkbox"
            className="admin-toggle"
            checked={row.availableOnline}
            disabled={isPending || !row.inStock}
            onChange={e => handleToggle('availableOnline', e.target.checked)}
          />
        </td>
      )}
    </tr>
  );
}
