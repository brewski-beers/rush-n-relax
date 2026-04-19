export const dynamic = 'force-dynamic';

import { requireRole } from '@/lib/admin-auth';
import { AdminBackLink } from '@/components/admin/AdminBackLink';
import { LocationCreateForm } from './LocationCreateForm';

export default async function NewLocationPage() {
  await requireRole('owner');

  return (
    <>
      <AdminBackLink href="/admin/locations" label="Locations" />
      <h1>New Location</h1>
      <LocationCreateForm />
    </>
  );
}
