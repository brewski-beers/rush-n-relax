export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { getLocationBySlug } from '@/lib/repositories';
import { LocationEditForm } from './LocationEditForm';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function LocationEditPage({ params }: Props) {
  const { slug } = await params;
  const location = await getLocationBySlug(slug);
  if (!location) notFound();

  return (
    <>
      <h1>Edit Location — {location.name}</h1>
      <LocationEditForm location={location} />
    </>
  );
}
