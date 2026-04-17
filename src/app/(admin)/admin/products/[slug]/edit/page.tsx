export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { requireRole, getAdminRole } from '@/lib/admin-auth';
import {
  getProductBySlug,
  listActiveCategories,
  listVariantTemplates,
  listVendors,
  listLocations,
} from '@/lib/repositories';
import { ProductEditForm } from './ProductEditForm';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ProductEditPage({ params }: Props) {
  await requireRole('staff');

  const { slug } = await params;
  const [product, categories, variantTemplates, vendors, locations, role] =
    await Promise.all([
      getProductBySlug(slug),
      listActiveCategories(),
      listVariantTemplates(),
      listVendors(),
      listLocations(),
      getAdminRole(),
    ]);
  if (!product) notFound();

  return (
    <>
      <h1>Edit Product — {product.name}</h1>
      <ProductEditForm
        product={product}
        categories={categories}
        variantTemplates={variantTemplates}
        vendors={vendors}
        locations={locations.map(l => ({ slug: l.slug, name: l.name }))}
        isOwner={role === 'owner'}
      />
    </>
  );
}
