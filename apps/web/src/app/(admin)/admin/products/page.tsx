export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { requireRole } from '@/lib/admin-auth';
import { listProducts, listActiveCategories } from '@/lib/repositories';
import { ProductsTable } from './ProductsTable';
import { ProductsFilters } from './ProductsFilters';
import { AdminTablePagination } from '@/components/admin/AdminTablePagination';

interface Props {
  searchParams: Promise<{
    cursor?: string;
    prevCursors?: string;
    category?: string;
    q?: string;
  }>;
}

export default async function AdminProductsPage({ searchParams }: Props) {
  await requireRole('staff');

  const {
    cursor,
    prevCursors: prevCursorsRaw,
    category,
    q,
  } = await searchParams;
  const prevCursors = prevCursorsRaw
    ? prevCursorsRaw.split(',').filter(Boolean)
    : [];

  const [{ items: products, nextCursor }, { items: categoryList }] =
    await Promise.all([
      listProducts({ limit: 50, cursor, category, search: q }),
      listActiveCategories({ limit: 100 }),
    ]);

  const prevCursor = prevCursors.at(-1);
  const prevStack = prevCursors.slice(0, -1);
  const nextStack = cursor ? [...prevCursors, cursor] : prevCursors;

  // Filters need to round-trip through the pagination links so paging within
  // a filtered view preserves the filter.
  const filterParams = new URLSearchParams();
  if (category) filterParams.set('category', category);
  if (q) filterParams.set('q', q);
  const baseHref = filterParams.toString()
    ? `/admin/products?${filterParams.toString()}`
    : '/admin/products';

  return (
    <>
      <div className="admin-page-header">
        <h1>Products</h1>
        <Link href="/admin/products/new" className="admin-btn-primary">
          New Product
        </Link>
      </div>
      <ProductsFilters
        categories={categoryList.map(c => ({ slug: c.slug, name: c.label }))}
        initial={{ category, q }}
      />
      <ProductsTable initialProducts={products} />
      <AdminTablePagination
        baseHref={baseHref}
        prevCursor={prevCursor}
        nextCursor={nextCursor}
        prevCursorsStack={prevStack}
        nextCursorsStack={nextStack}
      />
    </>
  );
}
