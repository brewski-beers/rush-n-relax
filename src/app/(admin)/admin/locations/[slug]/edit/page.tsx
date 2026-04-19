export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import { getLocationBySlug } from '@/lib/repositories';
import { AdminBackLink } from '@/components/admin/AdminBackLink';
import { LocationEditForm } from './LocationEditForm';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function LocationEditPage({ params }: Props) {
  await requireRole('owner');

  const { slug } = await params;
  const location = await getLocationBySlug(slug);
  if (!location) notFound();

  return (
    <>
      <AdminBackLink href="/admin/locations" label="Locations" />
      <h1>Edit Location — {location.name}</h1>
      <LocationEditForm location={location} />
    </>
  );
}
