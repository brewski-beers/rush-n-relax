export const dynamic = 'force-dynamic';

import { requireRole } from '@/lib/admin-auth';
import { AdminBackLink } from '@/components/admin/AdminBackLink';
import { VendorCreateForm } from './VendorCreateForm';

export default async function NewVendorPage() {
  await requireRole('owner');

  return (
    <>
      <AdminBackLink href="/admin/vendors" label="Vendors" />
      <h1>New Vendor</h1>
      <VendorCreateForm />
    </>
  );
}
