export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { getPromoBySlug } from '@/lib/repositories';
import { PromoEditForm } from './PromoEditForm';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function PromoEditPage({ params }: Props) {
  const { slug } = await params;
  const promo = await getPromoBySlug(slug);
  if (!promo) notFound();

  return (
    <>
      <h1>Edit Promo — {promo.name}</h1>
      <PromoEditForm promo={promo} />
    </>
  );
}
