import { requireRole } from '@/lib/admin-auth';
import { DashboardGrid } from './DashboardGrid';

export default async function DashboardPage() {
  const { role } = await requireRole('staff');

  return (
    <>
      <div className="admin-page-header">
        <h1>Admin Dashboard</h1>
      </div>
      <p className="admin-section-desc">
        Control locations, products, promos, and inventory from one workspace.
        Drag cards to arrange your preferred layout.
      </p>
      <DashboardGrid role={role} />
    </>
  );
}
