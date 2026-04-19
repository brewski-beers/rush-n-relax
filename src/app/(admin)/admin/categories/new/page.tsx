export const dynamic = 'force-dynamic';

import { requireRole } from '@/lib/admin-auth';
import { AdminBackLink } from '@/components/admin/AdminBackLink';
import { CategoryCreateForm } from './CategoryCreateForm';

export default async function NewCategoryPage() {
  await requireRole('staff');

  return (
    <>
      <AdminBackLink href="/admin/categories" label="Categories" />
      <h1>New Category</h1>
      <CategoryCreateForm />
    </>
  );
}
