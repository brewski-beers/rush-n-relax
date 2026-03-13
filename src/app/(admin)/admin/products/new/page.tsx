export const dynamic = 'force-dynamic';

import { requireRole } from '@/lib/admin-auth';
import { listLocations } from '@/lib/repositories';
import { ProductCreateForm } from './ProductCreateForm';

export default async function NewProductPage() {
  await requireRole('owner');

  const locations = await listLocations();

  return (
    <>
      <h1>New Product</h1>
      <ProductCreateForm locations={locations} />
    </>
  );
}
