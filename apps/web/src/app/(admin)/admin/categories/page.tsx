export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { requireRole } from '@/lib/admin-auth';
import { listAllCategories } from '@/lib/repositories';
import { CategoriesTable } from './CategoriesTable';

export default async function AdminCategoriesPage() {
  await requireRole('staff');
  const { items: categories } = await listAllCategories();

  return (
    <>
      <div className="admin-page-header">
        <h1>Categories</h1>
        <Link href="/admin/categories/new" className="admin-btn-primary">
          New Category
        </Link>
      </div>
      <CategoriesTable initialCategories={categories} />
    </>
  );
}
