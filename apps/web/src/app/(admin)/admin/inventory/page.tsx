export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { requireRole } from '@/lib/admin-auth';
import { listLocations } from '@/lib/repositories';
import { ONLINE_LOCATION_ID } from '@/lib/firebase/admin';

/**
 * #311: Inventory editing has been folded into the product editor. This
 * landing page now points users to /admin/products and surfaces a
 * deprecation banner. The per-location inventory pages still render until
 * the cleanup sub-issue (#312) deletes them entirely.
 */
export default async function AdminInventoryPage() {
  await requireRole('owner');

  const locations = await listLocations();

  return (
    <>
      <div className="admin-page-header">
        <h1>Inventory</h1>
      </div>
      <div className="admin-banner-warning" role="status">
        <strong>Heads up — inventory editing has moved.</strong>
        <p>
          Each product&apos;s stock, price, pickup, and featured state are now
          edited inside the product editor. Open a product from{' '}
          <Link href="/admin/products">Products</Link> and use the new{' '}
          <em>Variants &amp; Stock</em> section. The per-location pages below
          remain available for transition reference and will be removed soon.
        </p>
      </div>
      <p className="admin-section-desc">
        Legacy per-location inventory pages (read-only mirror — pending
        removal).
      </p>
      <div className="dashboard-links">
        <Link
          href={`/admin/inventory/${ONLINE_LOCATION_ID}`}
          className="dashboard-card admin-hub-card"
        >
          Online Store
          <span className="admin-card-sub">Storefront · Featured Products</span>
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
