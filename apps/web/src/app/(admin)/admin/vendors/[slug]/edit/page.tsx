export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import { getVendorBySlug } from '@/lib/repositories';
import { AdminBackLink } from '@/components/admin/AdminBackLink';
import { VendorEditForm } from './VendorEditForm';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function VendorEditPage({ params }: Props) {
  await requireRole('owner');

  const { slug } = await params;
  const vendor = await getVendorBySlug(slug);
  if (!vendor) notFound();

  return (
    <>
      <AdminBackLink href="/admin/vendors" label="Vendors" />
      <h1>Edit Vendor — {vendor.name}</h1>
      <VendorEditForm vendor={vendor} />
    </>
  );
}
