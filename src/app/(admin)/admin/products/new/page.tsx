export const dynamic = 'force-dynamic';

import { requireRole } from '@/lib/admin-auth';
import {
  listLocations,
  listActiveCategories,
  listAllVendors,
} from '@/lib/repositories';
import { ProductCreateForm } from './ProductCreateForm';

export default async function NewProductPage() {
  await requireRole('owner');

  const [locations, categories, vendors] = await Promise.all([
    listLocations(),
    listActiveCategories(),
    listAllVendors(),
  ]);

  return (
    <>
      <h1>New Product</h1>
      <ProductCreateForm
        locations={locations}
        categories={categories}
        vendors={vendors}
      />
    </>
  );
}
