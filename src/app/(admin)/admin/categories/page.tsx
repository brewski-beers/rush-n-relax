export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { requireRole } from '@/lib/admin-auth';
import { listAllCategories } from '@/lib/repositories';
import { ConfirmButton } from '@/components/admin/ConfirmButton';
import { toggleCategoryStatus } from './actions';

export default async function AdminCategoriesPage() {
  await requireRole('owner');

  const categories = await listAllCategories();

  return (
    <>
      <div className="admin-page-header">
        <h1>Categories</h1>
        <Link href="/admin/categories/new" className="admin-btn-primary">
          New Category
        </Link>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Slug</th>
              <th>Label</th>
              <th>Order</th>
              <th>Description</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => (
              <tr key={cat.slug}>
                <td>{cat.slug}</td>
                <td>{cat.label}</td>
                <td>{cat.order}</td>
                <td>
                  {cat.description.length > 50
                    ? `${cat.description.slice(0, 50)}…`
                    : cat.description}
                </td>
                <td>
                  <span
                    className={
                      cat.isActive ? 'admin-badge-active' : 'admin-badge-inactive'
                    }
                  >
                    {cat.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="admin-actions">
                  <Link href={`/admin/categories/${cat.slug}/edit`}>Edit</Link>
                  <ConfirmButton
                    action={toggleCategoryStatus.bind(
                      null,
                      cat.slug,
                      cat.isActive
                    )}
                    message={
                      cat.isActive
                        ? `Deactivate "${cat.label}"? It will be hidden from the storefront.`
                        : `Activate "${cat.label}"?`
                    }
                  >
                    {cat.isActive ? 'Deactivate' : 'Activate'}
                  </ConfirmButton>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={6} className="admin-empty">
                  No categories found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
