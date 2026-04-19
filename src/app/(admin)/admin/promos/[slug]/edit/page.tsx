export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import { getPromoBySlug } from '@/lib/repositories';
import { AdminBackLink } from '@/components/admin/AdminBackLink';
import { PromoEditForm } from './PromoEditForm';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function PromoEditPage({ params }: Props) {
  await requireRole('owner');

  const { slug } = await params;
  const promo = await getPromoBySlug(slug);
  if (!promo) notFound();

  return (
    <>
      <AdminBackLink href="/admin/promos" label="Promos" />
      <h1>Edit Promo — {promo.name}</h1>
      <PromoEditForm promo={promo} />
    </>
  );
}
