export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { requireRole } from '@/lib/admin-auth';
import { listProducts } from '@/lib/repositories';
import { ProductsTable } from './ProductsTable';

interface Props {
  searchParams: Promise<{ cursor?: string }>;
}

export default async function AdminProductsPage({ searchParams }: Props) {
  await requireRole('staff');

  const { items: products, nextCursor } = await listProducts({ limit: 50, cursor: (await searchParams)?.cursor });

  return (
    <>
      <div className="admin-page-header">
        <h1>Products</h1>
        <Link href="/admin/products/new" className="admin-btn-primary">
          New Product
        </Link>
      </div>
      <ProductsTable initialProducts={products} />
    </>
  );
}
