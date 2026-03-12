export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { listLocations } from '@/lib/repositories';

export default async function AdminLocationsPage() {
  const locations = await listLocations();

  return (
    <>
      <div className="admin-page-header">
        <h1>Locations</h1>
        <Link href="/admin/locations/new" className="admin-btn-primary">
          New Location
        </Link>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>City</th>
            <th>Phone</th>
            <th>Hours</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {locations.map(loc => (
            <tr key={loc.id}>
              <td>{loc.name}</td>
              <td>{loc.city}</td>
              <td>{loc.phone}</td>
              <td>{loc.hours}</td>
              <td>
                <Link href={`/admin/locations/${loc.slug}/edit`}>Edit</Link>
              </td>
            </tr>
          ))}
          {locations.length === 0 && (
            <tr>
              <td colSpan={5} className="admin-empty">
                No locations found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
