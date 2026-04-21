export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { requireRole } from '@/lib/admin-auth';
import { listProducts } from '@/lib/repositories';
import { ProductsTable } from './ProductsTable';
import { AdminTablePagination } from '@/components/admin/AdminTablePagination';

interface Props {
  searchParams: Promise<{ cursor?: string; prevCursors?: string }>;
}

export default async function AdminProductsPage({ searchParams }: Props) {
  await requireRole('staff');

  const { cursor, prevCursors: prevCursorsRaw } = await searchParams;
  const prevCursors = prevCursorsRaw
    ? prevCursorsRaw.split(',').filter(Boolean)
    : [];

  const { items: products, nextCursor } = await listProducts({
    limit: 50,
    cursor,
  });

  // Build prev URL: pop the last cursor off the stack
  const prevCursor = prevCursors.at(-1);
  const prevStack = prevCursors.slice(0, -1);

  // Build next URL: push current cursor onto the stack
  const nextStack = cursor ? [...prevCursors, cursor] : prevCursors;

  return (
    <>
      <div className="admin-page-header">
        <h1>Products</h1>
        <Link href="/admin/products/new" className="admin-btn-primary">
          New Product
        </Link>
      </div>
      <ProductsTable initialProducts={products} />
      <AdminTablePagination
        baseHref="/admin/products"
        prevCursor={prevCursor}
        nextCursor={nextCursor}
        prevCursorsStack={prevStack}
        nextCursorsStack={nextStack}
      />
    </>
  );
}
