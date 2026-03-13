import Link from 'next/link';
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
        <Link href="/">Back to Client Site</Link>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
