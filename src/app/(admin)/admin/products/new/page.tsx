export const dynamic = 'force-dynamic';

import { requireRole } from '@/lib/admin-auth';
import {
  listActiveCategories,
  listVariantTemplates,
  listVendors,
} from '@/lib/repositories';
import { AdminBackLink } from '@/components/admin/AdminBackLink';
import { ProductCreateForm } from './ProductCreateForm';

export default async function NewProductPage() {
  await requireRole('staff');

  const [categoriesPage, variantTemplates, vendorsPage] = await Promise.all([
    listActiveCategories(),
    listVariantTemplates(),
    listVendors(),
  ]);
  const { items: categories } = categoriesPage;
  const { items: vendors } = vendorsPage;

  return (
    <>
      <AdminBackLink href="/admin/products" label="Products" />
      <h1>New Product</h1>
      <ProductCreateForm
        categories={categories}
        variantTemplates={variantTemplates}
        vendors={vendors}
      />
    </>
  );
}
