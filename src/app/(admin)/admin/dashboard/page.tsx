import Link from 'next/link';

export default function DashboardPage() {
  return (
    <>
      <h1>Admin Dashboard</h1>
      <div className="dashboard-links">
        <Link href="/admin/locations" className="dashboard-card">
          Manage Locations
        </Link>
        <Link href="/admin/products" className="dashboard-card">
          Manage Products
        </Link>
        <Link href="/admin/promos" className="dashboard-card">
          Manage Promos
        </Link>
        <Link href="/admin/inventory" className="dashboard-card">
          Manage Inventory
        </Link>
      </div>
    </>
  );
}
