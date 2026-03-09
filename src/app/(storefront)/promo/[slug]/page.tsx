import { notFound } from 'next/navigation';
import { getPromoBySlug } from '@/lib/repositories';
import { buildMetadata } from '@/lib/seo/metadata.factory';
import { seoConfig } from '@/config/seo.config';
import PromoClient from './PromoClient';

interface Props {
  params: Promise<{ slug: string }>;
}

// Promos are time-limited — revalidate frequently
export const revalidate = 300;

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const promo = await getPromoBySlug(slug);
  if (!promo || !promo.active) return {};

  const isExpired = promo.endDate
    ? new Date(promo.endDate) < new Date()
    : false;

  return buildMetadata('/promo/[slug]', {
    title: `${promo.name} — Rush N Relax`,
    description: promo.description || promo.tagline,
    canonical: `${seoConfig.site.domain}/promo/${slug}`,
    path: `/promo/${slug}`,
    // Expired promos must not be indexed
    noindex: isExpired,
  });
}

export default async function PromoPage({ params }: Props) {
  const { slug } = await params;
  const promo = await getPromoBySlug(slug);
  if (!promo || !promo.active) notFound();
  return <PromoClient slug={slug} />;
}
