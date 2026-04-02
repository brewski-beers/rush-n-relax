export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { requireRole } from '@/lib/admin-auth';
import { listAllVendors } from '@/lib/repositories';
import { ConfirmButton } from '@/components/admin/ConfirmButton';
import { deactivateVendor, activateVendor } from './actions';

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
              <th>Description Source</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map(vendor => (
              <tr
                key={vendor.id}
                data-status={vendor.isActive ? 'active' : 'inactive'}
              >
                <td>{vendor.name}</td>
                <td>{vendor.descriptionSource}</td>
                <td>
                  <span
                    className={
                      vendor.isActive
                        ? 'admin-badge-active'
                        : 'admin-badge-inactive'
                    }
                  >
                    {vendor.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="admin-actions">
                  <Link href={`/admin/vendors/${vendor.slug}/edit`}>Edit</Link>
                  {vendor.isActive ? (
                    <ConfirmButton
                      action={deactivateVendor.bind(null, vendor.slug)}
                      message={`Deactivate "${vendor.name}"?`}
                    >
                      Deactivate
                    </ConfirmButton>
                  ) : (
                    <ConfirmButton
                      action={activateVendor.bind(null, vendor.slug)}
                      message={`Activate "${vendor.name}"?`}
                    >
                      Activate
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
