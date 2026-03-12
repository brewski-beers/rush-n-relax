export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { listActivePromos } from '@/lib/repositories';

export default async function AdminPromosPage() {
  const promos = await listActivePromos();

  return (
    <>
      <h1>Promos</h1>
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
            <tr key={promo.id}>
              <td>{promo.name}</td>
              <td>{promo.tagline}</td>
              <td>{promo.locationSlug ?? 'All'}</td>
              <td>{promo.active ? 'Yes' : 'No'}</td>
              <td>
                <Link href={`/admin/promos/${promo.slug}/edit`}>Edit</Link>
              </td>
            </tr>
          ))}
          {promos.length === 0 && (
            <tr>
              <td colSpan={5} className="admin-empty">
                No active promos found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
