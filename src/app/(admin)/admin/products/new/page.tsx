export const dynamic = 'force-dynamic';

import { requireRole } from '@/lib/admin-auth';
import {
  listActiveCategories,
  listVariantTemplates,
  listVendors,
} from '@/lib/repositories';
import { ProductCreateForm } from './ProductCreateForm';

export default async function NewProductPage() {
  await requireRole('staff');

  const [categories, variantTemplates, vendors] = await Promise.all([
    listActiveCategories(),
    listVariantTemplates(),
    listVendors(),
  ]);

  return (
    <>
      <h1>New Product</h1>
      <ProductCreateForm
        categories={categories}
        variantTemplates={variantTemplates}
        vendors={vendors}
      />
    </>
  );
}
