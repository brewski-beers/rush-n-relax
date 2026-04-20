export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { requireRole } from '@/lib/admin-auth';
import { listAllVendors } from '@/lib/repositories';
import { ConfirmButton } from '@/components/admin/ConfirmButton';
import { AdminTablePagination } from '@/components/admin/AdminTablePagination';
import { archiveVendor, restoreVendor } from './actions';

interface Props {
  searchParams: Promise<{ cursor?: string; prevCursors?: string }>;
}

export default async function AdminVendorsPage({ searchParams }: Props) {
  await requireRole('owner');

  const { cursor, prevCursors: prevCursorsRaw } = await searchParams;
  const prevCursors = prevCursorsRaw
    ? prevCursorsRaw.split(',').filter(Boolean)
    : [];

  const { items: vendors, nextCursor } = await listAllVendors({
    limit: 50,
    cursor,
  });

  const prevCursor = prevCursors.at(-1);
  const prevStack = prevCursors.slice(0, -1);
  const nextStack = cursor ? [...prevCursors, cursor] : prevCursors;

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
      <AdminTablePagination
        baseHref="/admin/vendors"
        prevCursor={prevCursor}
        nextCursor={nextCursor}
        prevCursorsStack={prevStack}
        nextCursorsStack={nextStack}
      />
    </>
  );
}
