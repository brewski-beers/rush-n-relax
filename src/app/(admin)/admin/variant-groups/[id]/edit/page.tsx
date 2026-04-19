import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import { listVariantTemplates } from '@/lib/repositories';
import { VariantGroupForm } from '../../VariantGroupForm';
import { updateVariantGroupAction } from '../../actions';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditVariantGroupPage({ params }: Props) {
  await requireRole('staff');

  const { id } = await params;
  const all = await listVariantTemplates();
  const template = all.find(t => t.id === id);

  if (!template) notFound();

  return (
    <>
      <div className="admin-page-header">
        <h1>Edit Variant Group: {template.label}</h1>
      </div>
      <VariantGroupForm initial={template} onSave={updateVariantGroupAction} />
    </>
  );
}
