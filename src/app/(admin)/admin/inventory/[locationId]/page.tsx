export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import {
  listLocations,
  listProducts,
  listInventoryForLocation,
} from '@/lib/repositories';
import { ONLINE_LOCATION_ID } from '@/lib/firebase/admin';
import { AdminBackLink } from '@/components/admin/AdminBackLink';
import InventoryTable, { type InventoryRow } from './InventoryTable';

interface Props {
  params: Promise<{ locationId: string }>;
}

export default async function AdminInventoryLocationPage({ params }: Props) {
  await requireRole('owner');

  const { locationId } = await params;
  const isOnline = locationId === ONLINE_LOCATION_ID;

  const [locations, products, inventoryItems] = await Promise.all([
    listLocations(),
    listProducts(),
    listInventoryForLocation(locationId),
  ]);

  const location = isOnline
    ? { name: 'Online Store', city: 'Storefront', state: '' }
    : locations.find(l => l.id === locationId);

  if (!location) notFound();

  const inventoryMap = new Map(
    inventoryItems.map(item => [item.productId, item])
  );

  const rows: InventoryRow[] = products.map(product => {
    const inv = inventoryMap.get(product.id);
    return {
      ...product,
      quantity: inv?.quantity ?? 0,
      inStock: inv?.inStock ?? false,
      availableOnline: inv?.availableOnline ?? false,
      availablePickup: inv?.availablePickup ?? false,
      featured: inv?.featured ?? false,
      variantPricing: inv?.variantPricing,
      variants: product.variants,
    };
  });

  const locationLabel = isOnline ? 'Online Store' : location.name;

  return (
    <>
      <AdminBackLink href="/admin/inventory" label="Inventory" />
      <div className="admin-page-header">
        <h1>Inventory — {locationLabel}</h1>
      </div>
      {isOnline ? (
        <p className="admin-section-desc">
          Online storefront inventory. Toggle <strong>In Stock</strong> to list
          a product, <strong>Featured</strong> to spotlight it on the homepage,
          and set <strong>Variant Pricing</strong> to show prices on the product
          page.
        </p>
      ) : (
        <p className="admin-section-desc">
          Retail inventory for {location.name}. Toggle <strong>In Stock</strong>{' '}
          and <strong>Available Pickup</strong> to manage in-store availability.
        </p>
      )}
      <InventoryTable rows={rows} locationId={locationId} isOnline={isOnline} />
    </>
  );
}
