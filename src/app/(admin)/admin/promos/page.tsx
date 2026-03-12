export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { listAllPromos } from '@/lib/repositories';
import { ConfirmButton } from '@/components/admin/ConfirmButton';
import { destroyPromo } from './actions';

export default async function AdminPromosPage() {
  const promos = await listAllPromos();

  return (
    <>
      <div className="admin-page-header">
        <h1>Promos</h1>
        <Link href="/admin/promos/new" className="admin-btn-primary">
          New Promo
        </Link>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Tagline</th>
            <th>Location</th>
            <th>Active</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {promos.map(promo => (
            <tr key={promo.id} data-active={String(promo.active)}>
              <td>{promo.name}</td>
              <td>{promo.tagline}</td>
              <td>{promo.locationSlug ?? 'All'}</td>
              <td>{promo.active ? 'Yes' : 'No'}</td>
              <td className="admin-actions">
                <Link href={`/admin/promos/${promo.slug}/edit`}>Edit</Link>
                <ConfirmButton
                  action={destroyPromo.bind(null, promo.slug)}
                  message={`Delete "${promo.name}"? This cannot be undone.`}
                >
                  Delete
                </ConfirmButton>
              </td>
            </tr>
          ))}
          {promos.length === 0 && (
            <tr>
              <td colSpan={5} className="admin-empty">
                No promos found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
