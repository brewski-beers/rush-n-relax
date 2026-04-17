export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import {
  getProductBySlug,
  listActiveCategories,
  listVariantTemplates,
  listVendors,
} from '@/lib/repositories';
import { ProductEditForm } from './ProductEditForm';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ProductEditPage({ params }: Props) {
  await requireRole('staff');

  const { slug } = await params;
  const [product, categories, variantTemplates, vendors] = await Promise.all([
    getProductBySlug(slug),
    listActiveCategories(),
    listVariantTemplates(),
    listVendors(),
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
      />
    </>
  );
}
