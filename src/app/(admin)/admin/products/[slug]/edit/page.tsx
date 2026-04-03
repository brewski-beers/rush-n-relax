export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import {
  getProductBySlug,
  listLocations,
  listActiveCategories,
  listAllVendors,
} from '@/lib/repositories';
import { ProductEditForm } from './ProductEditForm';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ProductEditPage({ params }: Props) {
  const actor = await requireRole('owner');

  const { slug } = await params;
  const [product, locations, categories, vendors] = await Promise.all([
    getProductBySlug(slug),
    listLocations(),
    listActiveCategories(),
    listAllVendors(),
  ]);
  if (!product) notFound();

  return (
    <>
      <h1>Edit Product — {product.name}</h1>
      <ProductEditForm
        product={product}
        locations={locations}
        categories={categories}
        vendors={vendors}
        isOwner={actor.role === 'owner'}
      />
    </>
  );
}
