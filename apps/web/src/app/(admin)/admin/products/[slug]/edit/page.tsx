export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import {
  getProductBySlug,
  listActiveCategories,
  listLocations,
  listVariantTemplates,
  listVendors,
} from '@/lib/repositories';
import { ONLINE_LOCATION_ID } from '@/lib/firebase/admin';
import { AdminBackLink } from '@/components/admin/AdminBackLink';
import { VariantStockSection } from '@/components/admin/VariantStockSection';
import { ProductEditForm } from './ProductEditForm';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ProductEditPage({ params }: Props) {
  await requireRole('staff');

  const { slug } = await params;
  const [product, categoriesPage, variantTemplates, vendorsPage, locations] =
    await Promise.all([
      getProductBySlug(slug),
      listActiveCategories(),
      listVariantTemplates(),
      listVendors(),
      listLocations(),
    ]);
  if (!product) notFound();
  const { items: categories } = categoriesPage;
  const { items: vendors } = vendorsPage;

  return (
    <>
      <AdminBackLink href="/admin/products" label="Products" />
      <h1>Edit Product — {product.name}</h1>
      <ProductEditForm
        product={product}
        categories={categories}
        variantTemplates={variantTemplates}
        vendors={vendors}
      />
      {/* #311: Variants & Stock surface — replaces /admin/inventory/{loc}. */}
      <VariantStockSection
        product={product}
        locations={locations}
        onlineLocationId={ONLINE_LOCATION_ID}
      />
    </>
  );
}
