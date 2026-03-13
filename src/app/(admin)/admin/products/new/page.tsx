export const dynamic = 'force-dynamic';

import { listLocations } from '@/lib/repositories';
import { ProductCreateForm } from './ProductCreateForm';

export default async function NewProductPage() {
  const locations = await listLocations();

  return (
    <>
      <h1>New Product</h1>
      <ProductCreateForm locations={locations} />
    </>
  );
}
