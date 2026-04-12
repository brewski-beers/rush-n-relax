export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { requireRole } from '@/lib/admin-auth';
import { listAllVendors } from '@/lib/repositories';
import { ConfirmButton } from '@/components/admin/ConfirmButton';
import { toggleVendorActive } from './actions';

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
              <th>Slug</th>
              <th>Name</th>
              <th>Description Source</th>
              <th>Website</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map(vendor => (
              <tr key={vendor.slug}>
                <td>{vendor.slug}</td>
                <td>{vendor.name}</td>
                <td>{vendor.descriptionSource}</td>
                <td>
                  {vendor.website ? (
                    <a
                      href={vendor.website}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {vendor.website}
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
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
                  <ConfirmButton
                    action={toggleVendorActive.bind(
                      null,
                      vendor.slug,
                      vendor.isActive
                    )}
                    message={
                      vendor.isActive
                        ? `Deactivate "${vendor.name}"? It will be hidden from product forms.`
                        : `Activate "${vendor.name}"?`
                    }
                  >
                    {vendor.isActive ? 'Deactivate' : 'Activate'}
                  </ConfirmButton>
                </td>
              </tr>
            ))}
            {vendors.length === 0 && (
              <tr>
                <td colSpan={6} className="admin-empty">
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
