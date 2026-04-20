export const dynamic = 'force-dynamic';

import { requireRole } from '@/lib/admin-auth';
import { AdminBackLink } from '@/components/admin/AdminBackLink';
import { PromoCreateForm } from './PromoCreateForm';

export default async function NewPromoPage() {
  await requireRole('owner');

  return (
    <>
      <AdminBackLink href="/admin/promos" label="Promos" />
      <h1>New Promo</h1>
      <PromoCreateForm />
    </>
  );
}
