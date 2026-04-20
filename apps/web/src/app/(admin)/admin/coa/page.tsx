export const dynamic = 'force-dynamic';

import { requireRole } from '@/lib/admin-auth';
import { listCoaDocuments } from '@/lib/repositories';
import { CoaAdminTable } from './CoaAdminTable';

export default async function AdminCoaPage() {
  const actor = await requireRole('staff');
  const isOwner = actor.role === 'owner';

  const docs = await listCoaDocuments();

  return (
    <>
      <div className="admin-page-header">
        <h1>Certificates of Analysis</h1>
      </div>
      <CoaAdminTable docs={docs} isOwner={isOwner} />
    </>
  );
}
