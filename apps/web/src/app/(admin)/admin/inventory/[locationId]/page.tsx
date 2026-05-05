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

const DEFAULT_VARIANT_ID = 'default';

interface Props {
  params: Promise<{ locationId: string }>;
}

export default async function AdminInventoryLocationPage({ params }: Props) {
  await requireRole('owner');

  const { locationId } = await params;
  const isOnline = locationId === ONLINE_LOCATION_ID;

  // Inventory is sourced from `products/{slug}.variantSpecs.default
  // .locations[locationId]` (issue #358). The legacy inventory lookup is
  // retained only to preserve `variantPricing` for the multi-variant editor
  // panel, which has not yet been migrated.
  const [locations, productsPage, inventoryPage] = await Promise.all([
    listLocations(),
    listProducts({ limit: 500 }),
    listInventoryForLocation(locationId, { limit: 500 }),
  ]);

  const { items: products } = productsPage;
  const { items: inventoryItems } = inventoryPage;

  const location = isOnline
    ? { name: 'Online Store', city: 'Storefront', state: '' }
    : locations.find(l => l.id === locationId);

  if (!location) notFound();

  const variantPricingMap = new Map(
    inventoryItems.map(item => [item.productId, item.variantPricing])
  );

  const rows: InventoryRow[] = products.map(product => {
    const loc =
      product.variantSpecs?.[DEFAULT_VARIANT_ID]?.locations?.[locationId];
    const qty = loc?.qty ?? 0;
    const inStock = qty > 0;
    return {
      ...product,
      quantity: qty,
      inStock,
      availableOnline: isOnline ? inStock : false,
      availablePickup: loc?.availablePickup ?? false,
      featured: loc?.featured ?? false,
      variantPricing: variantPricingMap.get(product.id),
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
