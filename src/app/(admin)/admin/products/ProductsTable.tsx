'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ConfirmButton } from '@/components/admin/ConfirmButton';
import {
  archiveProduct,
  restoreProduct,
  fetchArchivedProductsAction,
} from './actions';
import type { ProductSummary } from '@/types';

interface Props {
  initialProducts: ProductSummary[];
}

export function ProductsTable({ initialProducts }: Props) {
  const [activeProducts] = useState<ProductSummary[]>(initialProducts);
  const [archivedProducts, setArchivedProducts] = useState<
    ProductSummary[] | null
  >(null);
  const [showArchived, setShowArchived] = useState(false);
  const [loadingArchived, setLoadingArchived] = useState(false);

  async function handleShowArchived(checked: boolean) {
    setShowArchived(checked);
    if (checked && archivedProducts === null) {
      setLoadingArchived(true);
      const result = await fetchArchivedProductsAction();
      setArchivedProducts(result);
      setLoadingArchived(false);
    }
  }

  const products = showArchived
    ? [...activeProducts, ...(archivedProducts ?? [])]
    : activeProducts;

  return (
    <>
      <div className="admin-table-toolbar">
        <label className="admin-checkbox-label">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={e => void handleShowArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loadingArchived ? (
              <tr>
                <td colSpan={4} className="admin-empty">
                  Loading archived products…
                </td>
              </tr>
            ) : (
              <>
                {products.map(product => (
                  <tr key={product.id} data-status={product.status}>
                    <td>{product.name}</td>
                    <td>{product.category}</td>
                    <td>{product.status}</td>
                    <td className="admin-actions">
                      <Link href={`/admin/products/${product.slug}/edit`}>
                        Edit
                      </Link>
                      {product.status === 'archived' ? (
                        <ConfirmButton
                          action={restoreProduct.bind(null, product.slug)}
                          message={`Restore "${product.name}"?`}
                        >
                          Restore
                        </ConfirmButton>
                      ) : product.status !== 'compliance-hold' ? (
                        <ConfirmButton
                          action={archiveProduct.bind(null, product.slug)}
                          message={`Archive "${product.name}"? It will be hidden from the storefront.`}
                        >
                          Archive
                        </ConfirmButton>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={4} className="admin-empty">
                      No products found.
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
