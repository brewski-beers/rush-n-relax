export const dynamic = 'force-dynamic';

import { requireRole } from '@/lib/admin-auth';
import { PromoCreateForm } from './PromoCreateForm';

export default async function NewPromoPage() {
  await requireRole('owner');

  return (
    <>
      <h1>New Promo</h1>
      <PromoCreateForm />
    </>
  );
}
