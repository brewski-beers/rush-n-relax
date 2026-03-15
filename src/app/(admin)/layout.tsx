import Link from 'next/link';
import { AdminNav } from './AdminNav';
import '@/styles/admin.css';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-root">
      <header className="admin-header">
        <Link href="/admin/dashboard" className="admin-brand">
          Rush N Relax Admin
        </Link>
        <AdminNav />
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
