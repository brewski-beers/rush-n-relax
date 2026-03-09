export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { listLocations } from '@/lib/repositories';
import { HUB_LOCATION_ID } from '@/lib/firebase/admin';

export default async function AdminInventoryPage() {
  const locations = await listLocations();

  return (
    <>
      <h1>Inventory</h1>
      <p className="admin-section-desc">
        Manage product stock levels by location. Select a location to view and
        update its inventory.
      </p>
      <div className="dashboard-links">
        <Link
          href={`/admin/inventory/${HUB_LOCATION_ID}`}
          className="dashboard-card admin-hub-card"
        >
          RnR Hub
          <span className="admin-card-sub">Warehouse · Online Store</span>
        </Link>
        {locations.map(loc => (
          <Link
            key={loc.id}
            href={`/admin/inventory/${loc.id}`}
            className="dashboard-card"
          >
            {loc.name}
            <span className="admin-card-sub">
              {loc.city}, {loc.state}
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
