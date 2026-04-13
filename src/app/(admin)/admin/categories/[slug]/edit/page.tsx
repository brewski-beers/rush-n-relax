export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import { getCategoryBySlug } from '@/lib/repositories';
import { CategoryEditForm } from './CategoryEditForm';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function CategoryEditPage({ params }: Props) {
  await requireRole('staff');

  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  return (
    <>
      <h1>Edit Category — {category.label}</h1>
      <CategoryEditForm category={category} />
    </>
  );
}
