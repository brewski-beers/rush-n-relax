import { notFound } from 'next/navigation';
import { getLocationBySlug } from '@/lib/repositories';
import { buildMetadata } from '@/lib/seo/metadata.factory';
import { buildLocalBusinessSchema } from '@/lib/seo/schemas/local-business';
import { buildBreadcrumbSchema } from '@/lib/seo/schemas/breadcrumb';
import { JsonLd } from '@/components/JsonLd';
import { seoConfig } from '@/config/seo.config';
import LocationDetailClient from './LocationDetailClient';

interface Props {
  params: Promise<{ slug: string }>;
}

export const revalidate = 3600; // ISR: revalidate at most once per hour

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const location = await getLocationBySlug(slug);
  if (!location) return {};

  return buildMetadata('/locations/[slug]', {
    title: `${location.name} Dispensary — ${location.city}, TN`,
    description: location.seoDescription ?? location.description,
    canonical: `${seoConfig.site.domain}/locations/${slug}`,
    path: `/locations/${slug}`,
  });
}

export default async function LocationDetailPage({ params }: Props) {
  const { slug } = await params;
  const location = await getLocationBySlug(slug);
  if (!location) notFound();

  return (
    <>
      <JsonLd schema={buildLocalBusinessSchema(location)} />
      <JsonLd
        schema={buildBreadcrumbSchema([
          { name: 'Locations', href: '/locations' },
          { name: location.name, href: `/locations/${slug}` },
        ])}
      />
      <LocationDetailClient slug={slug} />
    </>
  );
}
