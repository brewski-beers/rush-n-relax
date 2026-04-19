export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { requireRole } from '@/lib/admin-auth';
import { listProducts } from '@/lib/repositories';
import { ProductsTable } from './ProductsTable';

export default async function AdminProductsPage() {
  await requireRole('staff');

  const products = await listProducts();

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
