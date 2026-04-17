export const dynamic = 'force-dynamic';

import { requireRole } from '@/lib/admin-auth';
import {
  listActiveCategories,
  listVariantTemplates,
  listVendors,
  listLocations,
} from '@/lib/repositories';
import { ProductCreateForm } from './ProductCreateForm';

export default async function NewProductPage() {
  await requireRole('staff');

  const [categories, variantTemplates, vendors, locations] = await Promise.all([
    listActiveCategories(),
    listVariantTemplates(),
    listVendors(),
    listLocations(),
  ]);

  return (
    <>
      <h1>New Product</h1>
      <ProductCreateForm
        categories={categories}
        variantTemplates={variantTemplates}
        vendors={vendors}
        locations={locations.map(l => ({ slug: l.slug, name: l.name }))}
      />
    </>
  );
}
