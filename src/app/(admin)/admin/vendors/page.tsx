export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { requireRole } from '@/lib/admin-auth';
import { listAllVendors } from '@/lib/repositories';
import { ConfirmButton } from '@/components/admin/ConfirmButton';
import { archiveVendor, restoreVendor } from './actions';

export default async function AdminVendorsPage() {
  await requireRole('owner');

  const vendors = await listAllVendors();

  return (
    <>
      <div className="admin-page-header">
        <h1>Vendors</h1>
        <Link href="/admin/vendors/new" className="admin-btn-primary">
          New Vendor
        </Link>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Categories</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map(vendor => (
              <tr
                key={vendor.id}
                data-status={vendor.isActive ? 'active' : 'archived'}
              >
                <td>{vendor.name}</td>
                <td>{vendor.categories.join(', ') || '—'}</td>
                <td>
                  <span
                    className={
                      vendor.isActive
                        ? 'admin-badge-active'
                        : 'admin-badge-inactive'
                    }
                  >
                    {vendor.isActive ? 'Active' : 'Archived'}
                  </span>
                </td>
                <td className="admin-actions">
                  <Link href={`/admin/vendors/${vendor.slug}/edit`}>Edit</Link>
                  {vendor.isActive ? (
                    <ConfirmButton
                      action={archiveVendor.bind(null, vendor.slug)}
                      message={`Archive "${vendor.name}"? It will be hidden from the storefront.`}
                    >
                      Archive
                    </ConfirmButton>
                  ) : (
                    <ConfirmButton
                      action={restoreVendor.bind(null, vendor.slug)}
                      message={`Restore "${vendor.name}"?`}
                    >
                      Restore
                    </ConfirmButton>
                  )}
                </td>
              </tr>
            ))}
            {vendors.length === 0 && (
              <tr>
                <td colSpan={4} className="admin-empty">
                  No vendors found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
