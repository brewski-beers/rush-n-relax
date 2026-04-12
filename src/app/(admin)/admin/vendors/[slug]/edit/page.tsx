export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import { getVendorBySlug } from '@/lib/repositories';
import { VendorEditForm } from './VendorEditForm';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function EditVendorPage({ params }: Props) {
  await requireRole('owner');

  const { slug } = await params;
  const vendor = await getVendorBySlug(slug);
  if (!vendor) notFound();

  return (
    <>
      <h1>Edit Vendor</h1>
      <VendorEditForm vendor={vendor} />
    </>
  );
}
