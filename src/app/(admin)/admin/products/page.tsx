export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { requireRole } from '@/lib/admin-auth';
import { listAllProducts } from '@/lib/repositories';
import { ConfirmButton } from '@/components/admin/ConfirmButton';
import { archiveProduct, restoreProduct } from './actions';

export default async function AdminProductsPage() {
  await requireRole('owner');

  const products = await listAllProducts();

  return (
    <>
      <div className="admin-page-header">
        <h1>Products</h1>
        <Link href="/admin/products/new" className="admin-btn-primary">
          New Product
        </Link>
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
          </tbody>
        </table>
      </div>
    </>
  );
}
