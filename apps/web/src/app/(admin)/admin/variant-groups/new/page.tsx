import { requireRole } from '@/lib/admin-auth';
import { VariantGroupForm } from '../VariantGroupForm';
import { createVariantGroupAction } from '../actions';

export default async function NewVariantGroupPage() {
  await requireRole('staff');

  return (
    <>
      <div className="admin-page-header">
        <h1>New Variant Group</h1>
      </div>
      <VariantGroupForm onSave={createVariantGroupAction} />
    </>
  );
}
