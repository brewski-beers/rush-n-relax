import Link from 'next/link';
import LogoutButton from './admin/LogoutButton';
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
        <Link href="/admin/locations">Locations</Link>
        <Link href="/admin/products">Products</Link>
        <Link href="/admin/promos">Promos</Link>
        <Link href="/admin/inventory">Inventory</Link>
        <Link href="/admin/users">Users</Link>
        <Link href="/admin/email-templates">Email Templates</Link>
        <Link href="/admin/email-queue">Email Queue</Link>
        <Link href="/">Back to Client Site</Link>
        <LogoutButton />
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
