export const dynamic = 'force-dynamic';

import { requireRole } from '@/lib/admin-auth';
import { LocationCreateForm } from './LocationCreateForm';

export default async function NewLocationPage() {
  await requireRole('owner');

  return (
    <>
      <h1>New Location</h1>
      <LocationCreateForm />
    </>
  );
}
