import Link from 'next/link';
import { AdminNav } from './AdminNav';
import { getAdminRole } from '@/lib/admin-auth';
import '@/styles/admin.css';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getAdminRole();

  return (
    <div className="admin-root">
      <header className="admin-header">
        <Link href="/admin/dashboard" className="admin-brand">
          Rush N Relax Admin
        </Link>
        <AdminNav role={role} />
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
