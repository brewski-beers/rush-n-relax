export const dynamic = 'force-dynamic';

import { requireRole } from '@/lib/admin-auth';
import { CategoryCreateForm } from './CategoryCreateForm';

export default async function NewCategoryPage() {
  await requireRole('owner');

  return (
    <>
      <h1>New Category</h1>
      <CategoryCreateForm />
    </>
  );
}
