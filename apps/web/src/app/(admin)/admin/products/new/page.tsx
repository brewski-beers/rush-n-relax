export const dynamic = 'force-dynamic';

import { requireRole } from '@/lib/admin-auth';
import {
  listActiveCategories,
  listVariantTemplates,
  listVendors,
} from '@/lib/repositories';
import { AdminBackLink } from '@/components/admin/AdminBackLink';
import { ProductCreateForm } from './ProductCreateForm';

interface PageProps {
  searchParams: Promise<{ created?: string }>;
}

export default async function NewProductPage({ searchParams }: PageProps) {
  await requireRole('staff');

  const [categoriesPage, variantTemplates, vendorsPage, params] =
    await Promise.all([
      listActiveCategories(),
      listVariantTemplates(),
      listVendors(),
      searchParams,
    ]);
  const { items: categories } = categoriesPage;
  const { items: vendors } = vendorsPage;
  const createdSlug = params.created;

  return (
    <>
      <AdminBackLink href="/admin/products" label="Products" />
      <h1>New Product</h1>
      {createdSlug && (
        <p className="admin-hint" role="status">
          Saved <strong>{createdSlug}</strong>. Add another below.
        </p>
      )}
      <ProductCreateForm
        categories={categories}
        variantTemplates={variantTemplates}
        vendors={vendors}
      />
    </>
  );
}
