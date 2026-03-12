export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import {
  listLocations,
  listProducts,
  listInventoryForLocation,
} from '@/lib/repositories';
import { HUB_LOCATION_ID } from '@/lib/firebase/admin';
import InventoryTable, { type InventoryRow } from './InventoryTable';

interface Props {
  params: Promise<{ locationId: string }>;
}

export default async function AdminInventoryLocationPage({ params }: Props) {
  const { locationId } = await params;
  const isHub = locationId === HUB_LOCATION_ID;

  const [locations, products, inventoryItems] = await Promise.all([
    listLocations(),
    listProducts(),
    listInventoryForLocation(locationId),
  ]);

  const location = isHub
    ? { name: 'RnR Hub', city: 'Warehouse', state: '' }
    : locations.find(l => l.id === locationId);

  if (!location) notFound();

  const inventoryMap = new Map(
    inventoryItems.map(item => [item.productId, item])
  );

  const rows: InventoryRow[] = products.map(product => {
    const inv = inventoryMap.get(product.id);
    return {
      ...product,
      inStock: inv?.inStock ?? false,
      availableOnline: inv?.availableOnline ?? false,
    };
  });

  const locationLabel = isHub ? 'RnR Hub' : `${location.name}`;

  return (
    <>
      <h1>Inventory — {locationLabel}</h1>
      {isHub && (
        <p className="admin-section-desc">
          Hub inventory. Toggle <strong>Available Online</strong> to promote
          in-stock products to the online store.
        </p>
      )}
      <InventoryTable rows={rows} locationId={locationId} isHub={isHub} />
    </>
  );
}
