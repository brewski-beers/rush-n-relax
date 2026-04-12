export const dynamic = 'force-dynamic';

import { requireRole } from '@/lib/admin-auth';
import { VendorCreateForm } from './VendorCreateForm';

export default async function NewVendorPage() {
  await requireRole('owner');

  return (
    <>
      <h1>New Vendor</h1>
      <VendorCreateForm />
    </>
  );
}
